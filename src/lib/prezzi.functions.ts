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