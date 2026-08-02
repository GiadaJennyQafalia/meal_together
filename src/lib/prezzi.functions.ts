import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type PrezzoProdotto = {
  id: string;
  nome_prodotto: string;
  supermercato: string;
  prezzo: number;
  unita: string;
  data_rilevazione: string;
  fonte: string;
  foto_scontrino: string | null;
  created_at: string;
};

export const SUPERMERCATI = ["Lidl", "Aldi", "Eurospar", "dm", "altro"] as const;
export const UNITA_PREZZO = ["€/kg", "€/pezzo", "€/l", "€/100g", "€/confezione"] as const;

export type SpesaScontrino = {
  id: string;
  data_acquisto: string;
  supermercato: string;
  totale: number | null;
  n_prodotti: number;
  foto_scontrino: string | null;
  created_at: string;
};

function server() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const listPrezzi = createServerFn({ method: "GET" }).handler(
  async (): Promise<PrezzoProdotto[]> => {
    const sb = server();
    const { data, error } = await sb
      .from("prezzi_prodotti")
      .select("*")
      .order("data_rilevazione", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PrezzoProdotto[];
  },
);

export const addPrezzo = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        nome_prodotto: z.string().min(1),
        supermercato: z.string().min(1).default("altro"),
        prezzo: z.number().nonnegative(),
        unita: z.string().min(1).default("€/pezzo"),
        data_rilevazione: z.string().optional(),
        fonte: z.enum(["manuale", "scontrino"]).default("manuale"),
        foto_scontrino: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<PrezzoProdotto> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("prezzi_prodotti")
      .insert({
        nome_prodotto: data.nome_prodotto.trim(),
        supermercato: data.supermercato,
        prezzo: data.prezzo,
        unita: data.unita,
        data_rilevazione: data.data_rilevazione ?? new Date().toISOString().slice(0, 10),
        fonte: data.fonte,
        foto_scontrino: data.foto_scontrino ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row as PrezzoProdotto;
  });

export const deletePrezzo = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const sb = server();
    const { error } = await sb.from("prezzi_prodotti").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });
export const updatePrezzo = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string(),
        nome_prodotto: z.string().min(1),
        supermercato: z.string().min(1),
        prezzo: z.number().nonnegative(),
        unita: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<PrezzoProdotto> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("prezzi_prodotti")
      .update({
        nome_prodotto: data.nome_prodotto.trim(),
        supermercato: data.supermercato,
        prezzo: data.prezzo,
        unita: data.unita,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row as PrezzoProdotto;
  });

export const listSpese = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpesaScontrino[]> => {
    const sb = server();
    const { data, error } = await sb
      .from("spese_scontrino")
      .select("*")
      .order("data_acquisto", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SpesaScontrino[];
  },
);

/** Estrae (senza salvare) i prezzi da uno scontrino gia' caricato nel bucket. */
export const analizzaScontrinoPrezzi = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ scontrino_path: z.string().min(1) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const sb = server();
    const { data: signed, error: signErr } = await sb.storage
      .from("scontrini")
      .createSignedUrl(data.scontrino_path, 600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(signErr?.message ?? "Impossibile generare URL scontrino");
    }
    const { extractPricesFromReceipt } = await import("./receipt-extract.server");
    return await extractPricesFromReceipt({ imageUrl: signed.signedUrl });
  });

const ProdottoScontrinoSchema = z.object({
  nome: z.string().min(1),
  prezzo: z.number().nonnegative(),
  unita: z.string().nullable().optional(),
});

/**
 * Importa uno scontrino in prezzi_prodotti + spese_scontrino.
 * Se `prodotti` viene passato (anteprima corretta a mano), salta l'estrazione AI.
 */
export const importScontrinoInPrezzi = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        scontrino_path: z.string().min(1),
        supermercato: z.string().min(1).optional(),
        data: z.string().nullable().optional(),
        totale: z.number().nullable().optional(),
        prodotti: z.array(ProdottoScontrinoSchema).optional(),
      })
      .parse(raw),
  )
  .handler(
    async ({
      data,
    }): Promise<{ spesa: SpesaScontrino; prodotti: PrezzoProdotto[] }> => {
      const sb = server();

      let supermercato = data.supermercato ?? "altro";
      let dataAcquisto = data.data ?? null;
      let totale = data.totale ?? null;
      let prodotti = data.prodotti ?? null;

      if (!prodotti) {
        const { data: signed, error: signErr } = await sb.storage
          .from("scontrini")
          .createSignedUrl(data.scontrino_path, 600);
        if (signErr || !signed?.signedUrl) {
          throw new Error(signErr?.message ?? "Impossibile generare URL scontrino");
        }
        const { extractPricesFromReceipt } = await import("./receipt-extract.server");
        const estratto = await extractPricesFromReceipt({ imageUrl: signed.signedUrl });
        supermercato = data.supermercato ?? estratto.supermercato;
        dataAcquisto = data.data ?? estratto.data;
        totale = data.totale ?? estratto.totale;
        prodotti = estratto.prodotti;
      }

      const dataRilevazione = dataAcquisto ?? new Date().toISOString().slice(0, 10);
      const totaleFinale =
        totale ?? (prodotti.length ? prodotti.reduce((s, p) => s + p.prezzo, 0) : null);

      const { data: spesa, error: spesaErr } = await sb
        .from("spese_scontrino")
        .insert({
          data_acquisto: dataRilevazione,
          supermercato,
          totale: totaleFinale === null ? null : Math.round(totaleFinale * 100) / 100,
          n_prodotti: prodotti.length,
          foto_scontrino: data.scontrino_path,
        })
        .select("*")
        .single();
      if (spesaErr) throw spesaErr;

      let righe: PrezzoProdotto[] = [];
      if (prodotti.length) {
        const { data: rows, error } = await sb
          .from("prezzi_prodotti")
          .insert(
            prodotti.map((p) => ({
              nome_prodotto: p.nome.trim(),
              supermercato,
              prezzo: p.prezzo,
              unita: p.unita ?? "€/pezzo",
              data_rilevazione: dataRilevazione,
              fonte: "scontrino",
              foto_scontrino: data.scontrino_path,
            })),
          )
          .select("*");
        if (error) throw error;
        righe = (rows ?? []) as PrezzoProdotto[];
      }

      return { spesa: spesa as SpesaScontrino, prodotti: righe };
    },
  );
