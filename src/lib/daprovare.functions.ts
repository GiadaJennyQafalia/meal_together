import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type DaProvare = {
  id: string;
  titolo: string;
  link_video: string | null;
  note: string;
  stato: string;
  data_aggiunta: string;
};

function server() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const listDaProvare = createServerFn({ method: "GET" }).handler(
  async (): Promise<DaProvare[]> => {
    const sb = server();
    const { data, error } = await sb
      .from("ricette_da_provare")
      .select("*")
      .order("data_aggiunta", { ascending: false });
    if (error) throw error;
    return (data ?? []) as DaProvare[];
  },
);

export const addDaProvare = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        titolo: z.string().min(1),
        link_video: z.string().optional().default(""),
        note: z.string().optional().default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<DaProvare> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("ricette_da_provare")
      .insert({
        titolo: data.titolo.trim(),
        link_video: data.link_video?.trim() || null,
        note: data.note ?? "",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row as DaProvare;
  });

export const updateDaProvare = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string(),
        patch: z.object({
          titolo: z.string().optional(),
          link_video: z.string().nullable().optional(),
          note: z.string().optional(),
          stato: z.string().optional(),
        }),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<DaProvare> => {
    const sb = server();
    const { data: row, error } = await sb
      .from("ricette_da_provare")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row as DaProvare;
  });

export const deleteDaProvare = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const sb = server();
    const { error } = await sb.from("ricette_da_provare").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const promuoviDaProvare = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<{ ricetta_id: string }> => {
    const sb = server();
    const { data: dp, error: e1 } = await sb
      .from("ricette_da_provare")
      .select("*")
      .eq("id", data.id)
      .single();
    if (e1) throw e1;
    if (!dp) throw new Error("Voce non trovata");

    const base = slugify(dp.titolo) || "ricetta";
    let id = base;
    let n = 1;
    // Ensure unique id
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: existing } = await sb
        .from("ricette")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (!existing) break;
      n += 1;
      id = `${base}-${n}`;
    }

    const noteFinal = [dp.note, dp.link_video ? `Video: ${dp.link_video}` : ""]
      .filter(Boolean)
      .join("\n\n");

    const { error: e2 } = await sb.from("ricette").insert({
      id,
      titolo: dp.titolo,
      note: noteFinal,
      da_rifare: true,
    });
    if (e2) throw e2;

    await sb
      .from("ricette_da_provare")
      .update({ stato: "provata" })
      .eq("id", data.id);

    return { ricetta_id: id };
  });