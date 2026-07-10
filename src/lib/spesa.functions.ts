import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type SpesaItem = {
  id: string;
  nome: string;
  reparto: string;
  quantita: string;
  checked: boolean;
  created_at: string;
};

function server() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const listSpesa = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpesaItem[]> => {
    const sb = server();
    const { data, error } = await sb
      .from("lista_spesa")
      .select("*")
      .order("checked", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as SpesaItem[];
  },
);

export const addSpesa = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        nome: z.string().min(1),
        reparto: z.string().min(1).default("Altro"),
        quantita: z.string().optional().default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<SpesaItem> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("lista_spesa")
      .insert({
        nome: data.nome.trim(),
        reparto: data.reparto,
        quantita: data.quantita ?? "",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row as SpesaItem;
  });

export const toggleSpesa = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string(), checked: z.boolean() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const sb = server();
    const { error } = await sb
      .from("lista_spesa")
      .update({ checked: data.checked })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteSpesa = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const sb = server();
    const { error } = await sb.from("lista_spesa").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const clearChecked = createServerFn({ method: "POST" }).handler(
  async () => {
    const sb = server();
    const { error } = await sb
      .from("lista_spesa")
      .delete()
      .eq("checked", true);
    if (error) throw error;
    return { ok: true as const };
  },
);

export const REPARTI = [
  "Frutta e verdura",
  "Carne",
  "Pesce",
  "Latticini",
  "Pane e cereali",
  "Dispensa",
  "Surgelati",
  "Bevande",
  "Casa",
  "Altro",
] as const;