import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, Upload, X, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  getRicetta,
  listCartelle,
  updateRicetta,
  type Ricetta,
} from "@/lib/ricette.functions";

export const Route = createFileRoute("/ricette/$id")({
  ssr: false,
  component: RicettaDetail,
});

function RicettaDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const load = useServerFn(getRicetta);
  const save = useServerFn(updateRicetta);
  const loadC = useServerFn(listCartelle);

  const { data, isLoading } = useQuery({
    queryKey: ["ricetta", id],
    queryFn: () => load({ data: { id } }),
  });
  const { data: cartelle } = useQuery({
    queryKey: ["cartelle"],
    queryFn: () => loadC(),
  });

  const [form, setForm] = useState<Ricetta | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<Ricetta>) =>
      save({ data: { id, patch: patch as never } }),
    onSuccess: (row) => {
      setForm(row);
      qc.invalidateQueries({ queryKey: ["ricette"] });
      qc.setQueryData(["ricetta", id], row);
      toast.success("Ricetta salvata");
    },
    onError: (err) => toast.error((err as Error).message ?? "Errore salvataggio"),
  });

  if (isLoading || !form) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">
        Apro la scheda…
      </div>
    );
  }

  const update = <K extends keyof Ricetta>(k: K, v: Ricetta[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t) return;
    const current = form.tag ?? [];
    if (current.includes(t)) {
      setTagDraft("");
      return;
    }
    update("tag", [...current, t]);
    setTagDraft("");
  };

  const removeTag = (t: string) =>
    update("tag", (form.tag ?? []).filter((x) => x !== t));

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("ricette-immagini")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from("ricette-immagini")
        .getPublicUrl(path);
      update("immagine_url", pub.publicUrl);
      toast.success("Immagine caricata — ricordati di salvare");
    } catch (e) {
      toast.error((e as Error).message ?? "Errore upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Link
            to="/ricette"
            className="rounded-full p-1.5 text-foreground hover:bg-muted/40"
            aria-label="Torna al ricettario"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {form.categoria ?? "Ricetta"}
            </p>
            <h1 className="truncate font-serif text-lg font-medium">
              {form.titolo}
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 pt-5">
        <div className="card-paper p-4">
          <Section title="Foto di copertina">
            <div className="flex items-center gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-black/10 bg-muted/40">
                {form.immagine_url ? (
                  <img
                    src={form.immagine_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-paper-foreground/40">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUpload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-black/10 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-paper-foreground hover:bg-white disabled:opacity-60"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Carico…" : form.immagine_url ? "Cambia" : "Carica"}
                </button>
                {form.immagine_url && (
                  <button
                    type="button"
                    onClick={() => update("immagine_url", null)}
                    className="text-[11px] text-paper-foreground/60 hover:text-destructive"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
            </div>
          </Section>

          <Section title="Cartella">
            <select
              value={form.cartella_id ?? ""}
              onChange={(e) =>
                update("cartella_id", e.target.value === "" ? null : e.target.value)
              }
              className={inputStyle}
            >
              <option value="">— Nessuna cartella —</option>
              {(cartelle ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Section>

          <Section title="Tag">
            <div className="flex flex-wrap gap-1.5">
              {(form.tag ?? []).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-paper-foreground"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-paper-foreground/50 hover:text-destructive"
                    aria-label={`Rimuovi ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="aggiungi tag…"
                className={inputStyle}
              />
              <button
                type="button"
                onClick={addTag}
                className="rounded-md border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-paper-foreground hover:bg-white"
              >
                +
              </button>
            </div>
          </Section>

          <Field label="Titolo">
            <input
              value={form.titolo}
              onChange={(e) => update("titolo", e.target.value)}
              className="w-full rounded-md border border-black/10 bg-white/70 px-2.5 py-1.5 font-serif text-lg text-paper-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </Field>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Voto (0-10)">
              <input
                type="number"
                min={0}
                max={10}
                value={form.voto ?? ""}
                onChange={(e) =>
                  update("voto", e.target.value === "" ? null : Number(e.target.value))
                }
                className={inputStyle}
              />
            </Field>
            <Field label="Da rifare">
              <button
                type="button"
                onClick={() => update("da_rifare", !form.da_rifare)}
                className={`w-full rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  form.da_rifare
                    ? "bg-primary text-primary-foreground"
                    : "bg-black/5 text-paper-foreground"
                }`}
              >
                {form.da_rifare ? "Sì" : "No"}
              </button>
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <NumField label="kcal" value={form.kcal} onChange={(v) => update("kcal", v)} />
            <NumField
              label="pro"
              value={form.proteine_g as number | null}
              onChange={(v) => update("proteine_g", v as never)}
            />
            <NumField
              label="carb"
              value={form.carboidrati_g as number | null}
              onChange={(v) => update("carboidrati_g", v as never)}
            />
            <NumField
              label="min"
              value={form.tempo_minuti}
              onChange={(v) => update("tempo_minuti", v)}
            />
          </div>

          <Section title="Ingredienti">
            <ArrayEditor
              value={form.ingredienti}
              onChange={(v) => update("ingredienti", v)}
              placeholder="es. 200g farina"
            />
          </Section>

          <Section title="Varianti">
            <ArrayEditor
              value={form.varianti}
              onChange={(v) => update("varianti", v)}
              placeholder="es. senza glutine"
            />
          </Section>

          <Section title="Note">
            <textarea
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
              rows={3}
              className={`${inputStyle} resize-none`}
            />
          </Section>

          <Section title="Scaling Francesco">
            <input
              value={form.scaling_francesco}
              onChange={(e) => update("scaling_francesco", e.target.value)}
              className={inputStyle}
            />
          </Section>

          <Section title="Modifiche personali">
            <textarea
              value={form.modifiche}
              onChange={(e) => update("modifiche", e.target.value)}
              rows={3}
              placeholder="Cosa cambiare la prossima volta…"
              className={`${inputStyle} resize-none`}
            />
          </Section>
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          <Button
            onClick={() => {
              if (!form) return;
              const { id: _id, ...patch } = form;
              mutation.mutate(patch);
            }}
            disabled={mutation.isPending}
            className="w-full gap-2"
            size="lg"
          >
            <Save className="h-4 w-4" />
            {mutation.isPending ? "Salvo…" : "Salva modifiche"}
          </Button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

const inputStyle =
  "w-full rounded-md border border-black/10 bg-white/70 px-2.5 py-1.5 text-sm text-paper-foreground focus:outline-none focus:ring-2 focus:ring-primary/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-paper-foreground/60">
        {label}
      </span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-black/10 pt-3">
      <p className="mb-2 font-serif text-sm font-medium uppercase tracking-wider text-paper-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block text-center">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-paper-foreground/60">
        {label}
      </span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className={`${inputStyle} tabular text-center`}
      />
    </label>
  );
}

function ArrayEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={item}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
            className={inputStyle}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded-md px-2 text-sm text-paper-foreground/60 hover:text-destructive"
            aria-label="Rimuovi"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, ""])}
        className="self-start rounded-md border border-dashed border-black/20 px-2.5 py-1 text-xs text-paper-foreground/70 hover:bg-black/5"
      >
        + {placeholder}
      </button>
    </div>
  );
}