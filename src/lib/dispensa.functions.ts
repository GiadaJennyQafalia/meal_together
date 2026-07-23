import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { extractProductsFromReceipt } from "./receipt-extract.server";

export type DispensaItem = {
  id: string;
  nome_ingrediente: string;
  quantita: number | null;
  unita: string | null;
  peso: number | null;
  categoria: string;
  scadenza: string | null;
  fonte: string;
  created_at: string;
  updated_at: string;
};

export const CATEGORIE_DISPENSA = [
  "fresco",
  "surgelato",
  "secco",
  "latticino",
  "altro",
] as const;

export const SCADENZA_DEFAULT_GG: Record<(typeof CATEGORIE_DISPENSA)[number], number> = {
  fresco: 7,
  surgelato: 180,
  secco: 365,
  latticino: 14,
  altro: 30,
};

export function suggerisciScadenza(categoria: string): string {
  const gg =
    SCADENZA_DEFAULT_GG[categoria as (typeof CATEGORIE_DISPENSA)[number]] ?? 30;
  const d = new Date();
  d.setDate(d.getDate() + gg);
  return d.toISOString().slice(0, 10);
}

function server() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const listDispensa = createServerFn({ method: "GET" }).handler(
  async (): Promise<DispensaItem[]> => {
    const sb = server();
    const { data, error } = await sb
      .from("dispensa")
      .select("*")
      .order("scadenza", { ascending: true, nullsFirst: false })
      .order("nome_ingrediente", { ascending: true });
    if (error) throw error;
    return (data ?? []) as DispensaItem[];
  },
);

const DispensaInputSchema = z.object({
  nome_ingrediente: z.string().min(1),
  quantita: z.number().nullable().optional(),
  unita: z.string().nullable().optional(),
  peso: z.number().nullable().optional(),
  categoria: z.enum(CATEGORIE_DISPENSA).default("altro"),
  scadenza: z.string().nullable().optional(),
  fonte: z.enum(["manuale", "scontrino"]).default("manuale"),
});

export const addDispensa = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => DispensaInputSchema.parse(raw))
  .handler(async ({ data }): Promise<DispensaItem> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("dispensa")
      .insert({
        nome_ingrediente: data.nome_ingrediente.trim(),
        quantita: data.quantita ?? null,
        unita: data.unita ?? null,
        peso: data.peso ?? null,
        categoria: data.categoria,
        scadenza: data.scadenza ?? null,
        fonte: data.fonte,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row as DispensaItem;
  });

export const updateDispensa = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string(),
        patch: DispensaInputSchema.partial(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<DispensaItem> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("dispensa")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row as DispensaItem;
  });

export const deleteDispensa = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const sb = server();
    const { error } = await sb.from("dispensa").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

/**
 * OCR scontrino -> Dispensa.
 * Riceve il path dell'immagine nel bucket `scontrini` (già uploadato dal client),
 * estrae i prodotti con il Lovable AI Gateway e li fonde con la dispensa esistente
 * (match per nome normalizzato: se esiste aggiorna quantità e updated_at, altrimenti insert).
 */
export const importScontrinoInDispensa = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        scontrino_path: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const sb = server();

    // Signed URL temporanea per far leggere l'immagine al modello.
    const { data: signed, error: signErr } = await sb.storage
      .from("scontrini")
      .createSignedUrl(data.scontrino_path, 600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(signErr?.message ?? "Impossibile generare URL scontrino");
    }

    const prodotti = await extractProductsFromReceipt({ imageUrl: signed.signedUrl });

    if (prodotti.length === 0) {
      return { aggiunti: 0, aggiornati: 0, righe: [] as DispensaItem[] };
    }

    const { data: existing } = await sb
      .from("dispensa")
      .select("id, nome_ingrediente, quantita, unita, categoria, scadenza, fonte, peso, created_at, updated_at");
    const index = new Map<string, DispensaItem>();
    for (const r of (existing ?? []) as DispensaItem[]) {
      index.set(normalizeName(r.nome_ingrediente), r);
    }

    let aggiunti = 0;
    let aggiornati = 0;
    const righe: DispensaItem[] = [];

    for (const p of prodotti) {
      const key = normalizeName(p.nome);
      if (!key) continue;
      const found = index.get(key);
      const categoria = p.categoria ?? "altro";
      const scadenza = suggerisciScadenza(categoria);

      if (found) {
        const nuovaQty = (found.quantita ?? 0) + (p.quantita ?? 1);
        const { data: row, error } = await sb
          .from("dispensa")
          .update({
            quantita: nuovaQty,
            unita: found.unita ?? p.unita ?? null,
            fonte: "scontrino",
          })
          .eq("id", found.id)
          .select("*")
          .single();
        if (!error && row) {
          aggiornati++;
          righe.push(row as DispensaItem);
        }
      } else {
        const { data: row, error } = await sb
          .from("dispensa")
          .insert({
            nome_ingrediente: p.nome.trim(),
            quantita: p.quantita ?? 1,
            unita: p.unita ?? null,
            categoria,
            scadenza,
            fonte: "scontrino",
          })
          .select("*")
          .single();
        if (!error && row) {
          aggiunti++;
          righe.push(row as DispensaItem);
          index.set(key, row as DispensaItem);
        }
      }
    }

    return { aggiunti, aggiornati, righe };
  });