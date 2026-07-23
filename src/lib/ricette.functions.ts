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
  cartella_id: string | null;
  tag: string[];
  immagine_url: string | null;
};

export type Cartella = {
  id: string;
  nome: string;
  ordine: number;
  immagine_url: string | null;
};

function server() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
    cartella_id: z.string().nullable().optional(),
    tag: z.array(z.string()).optional(),
    immagine_url: z.string().nullable().optional(),
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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "ricetta"
  );
}

// Crea una nuova ricetta vuota (solo titolo) con id univoco, pronta per
// essere aperta e compilata sulla scheda di dettaglio (/ricette/$id).
export const createRicetta = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ titolo: z.string().min(1) }).parse(raw))
  .handler(async ({ data }): Promise<Ricetta> => {
    const sb = server();
    const base = slugify(data.titolo);
    let id = base;
    let n = 1;

    while (true) {
      const { data: existing } = await sb.from("ricette").select("id").eq("id", id).maybeSingle();
      if (!existing) break;
      n += 1;
      id = `${base}-${n}`;
    }
    const { data: row, error } = await sb
      .from("ricette")
      .insert({ id, titolo: data.titolo.trim() })
      .select("*")
      .single();
    if (error) throw error;
    return row as Ricetta;
  });

// --- Cartelle ---

export const listCartelle = createServerFn({ method: "GET" }).handler(
  async (): Promise<Cartella[]> => {
    const sb = server();
    const { data, error } = await sb
      .from("cartelle")
      .select("id, nome, ordine, immagine_url")
      .order("ordine", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Cartella[];
  },
);

export const createCartella = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ nome: z.string().min(1).max(60) }).parse(raw))
  .handler(async ({ data }): Promise<Cartella> => {
    const sb = server();
    const { data: max } = await sb
      .from("cartelle")
      .select("ordine")
      .order("ordine", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (max?.ordine ?? 0) + 1;
    const { data: row, error } = await sb
      .from("cartelle")
      .insert({ nome: data.nome.trim(), ordine: nextOrder })
      .select("id, nome, ordine, immagine_url")
      .single();
    if (error) throw error;
    return row as Cartella;
  });

export const renameCartella = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string(), nome: z.string().min(1).max(60) }).parse(raw),
  )
  .handler(async ({ data }): Promise<Cartella> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("cartelle")
      .update({ nome: data.nome.trim() })
      .eq("id", data.id)
      .select("id, nome, ordine, immagine_url")
      .single();
    if (error) throw error;
    return row as Cartella;
  });

export const updateCartella = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string(),
        patch: z.object({
          nome: z.string().min(1).max(60).optional(),
          immagine_url: z.string().nullable().optional(),
        }),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<Cartella> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("cartelle")
      .update(data.patch)
      .eq("id", data.id)
      .select("id, nome, ordine, immagine_url")
      .single();
    if (error) throw error;
    return row as Cartella;
  });

export const deleteCartella = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sb = server();
    const { count, error: cErr } = await sb
      .from("ricette")
      .select("id", { count: "exact", head: true })
      .eq("cartella_id", data.id);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      throw new Error("Sposta prima le ricette dentro un'altra cartella.");
    }
    const { error } = await sb.from("cartelle").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
