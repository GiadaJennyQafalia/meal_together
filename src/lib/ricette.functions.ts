import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type Ricetta = {
  id: string;
  titolo: string;
  categoria: string | null;
  tipo: string | null;
  kcal: number | null;
  proteine_g: number | null;
  carboidrati_g: number | null;
  grassi_g: number | null;
  tempo_minuti: number | null;
  congelabile: boolean;
  voto: number | null;
  da_rifare: boolean;
  stagionalita: string[];
  ingredienti: string[];
  note: string;
  scaling_francesco: string;
  varianti: string[];
  modifiche: string;
};

function server() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const listRicette = createServerFn({ method: "GET" }).handler(
  async (): Promise<Ricetta[]> => {
    const sb = server();
    const { data, error } = await sb
      .from("ricette")
      .select("*")
      .order("titolo", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Ricetta[];
  },
);

export const getRicetta = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<Ricetta | null> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("ricette")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return (row as Ricetta | null) ?? null;
  });

const RicettaPatchSchema = z.object({
  id: z.string(),
  patch: z.object({
    titolo: z.string().optional(),
    categoria: z.string().nullable().optional(),
    tipo: z.string().nullable().optional(),
    kcal: z.number().nullable().optional(),
    proteine_g: z.number().nullable().optional(),
    carboidrati_g: z.number().nullable().optional(),
    grassi_g: z.number().nullable().optional(),
    tempo_minuti: z.number().nullable().optional(),
    congelabile: z.boolean().optional(),
    voto: z.number().nullable().optional(),
    da_rifare: z.boolean().optional(),
    stagionalita: z.array(z.string()).optional(),
    ingredienti: z.array(z.string()).optional(),
    note: z.string().optional(),
    scaling_francesco: z.string().optional(),
    varianti: z.array(z.string()).optional(),
    modifiche: z.string().optional(),
  }),
});

export const updateRicetta = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => RicettaPatchSchema.parse(raw))
  .handler(async ({ data }): Promise<Ricetta> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("ricette")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row as Ricetta;
  });