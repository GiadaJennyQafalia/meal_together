import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Camera, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  addPrezzo,
  deletePrezzo,
  listPrezzi,
  SUPERMERCATI,
  UNITA_PREZZO,
  type PrezzoProdotto,
} from "@/lib/prezzi.functions";

export const Route = createFileRoute("/prezzi")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Prezzi · Il Quaderno" },
      {
        name: "description",
        content:
          "Tracciamento prezzi per supermercato con foto scontrini condivise.",
      },
    ],
  }),
  component: PrezziPage,
});

function PrezziPage() {
  const qc = useQueryClient();
  const load = useServerFn(listPrezzi);
  const add = useServerFn(addPrezzo);
  const del = useServerFn(deletePrezzo);

  const { data } = useQuery({ queryKey: ["prezzi"], queryFn: () => load() });

  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<string>("tutti");
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["prezzi"] });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: invalidate,
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (filter === "tutti") return rows;
    return rows.filter((r) => r.supermercato === filter);
  }, [data, filter]);

  async function uploadScontrino(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("scontrini")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      return path;
    } catch (e) {
      toast.error((e as Error).message ?? "Upload fallito");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function onScontrinoOnly(file: File) {
    const path = await uploadScontrino(file);
    if (!path) return;
    try {
      await add({
        data: {
          nome_prodotto: `Scontrino ${new Date().toLocaleDateString("it-IT")}`,
          supermercato: "altro",
          prezzo: 0,
          unita: "€/pezzo",
          fonte: "scontrino",
          foto_scontrino: path,
        },
      });
      toast.success("Scontrino salvato");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message ?? "Errore");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground">
      <AppHeader
        title="Prezzi"
        subtitle={`${data?.length ?? 0} rilevazioni`}
        right={
          <div className="flex gap-1.5">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-[11px] uppercase tracking-wider text-foreground/70 hover:bg-muted/40 disabled:opacity-50"
            >
              <Camera className="h-3 w-3" />
              Scontrino
            </button>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] uppercase tracking-wider text-primary-foreground"
            >
              <Plus className="h-3 w-3" />
              Prezzo
            </button>
          </div>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onScontrinoOnly(f);
          e.target.value = "";
        }}
      />

      <div className="mx-auto max-w-xl px-4 pt-4">
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
          {(["tutti", ...SUPERMERCATI] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize tracking-wide transition-colors ${
                filter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-transparent text-foreground/80 hover:bg-muted/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Nessun prezzo salvato.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {filtered.map((p) => (
              <li key={p.id}>
                <PrezzoCard prezzo={p} onDelete={() => delM.mutate(p.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <AddPrezzoSheet
          onClose={() => setOpen(false)}
          onSubmit={async (payload) => {
            let fotoPath: string | null = null;
            if (payload.foto) {
              fotoPath = await uploadScontrino(payload.foto);
              if (!fotoPath) return;
            }
            try {
              await add({
                data: {
                  nome_prodotto: payload.nome,
                  supermercato: payload.super,
                  prezzo: payload.prezzo,
                  unita: payload.unita,
                  fonte: fotoPath ? "scontrino" : "manuale",
                  foto_scontrino: fotoPath,
                },
              });
              toast.success("Prezzo salvato");
              invalidate();
              setOpen(false);
            } catch (e) {
              toast.error((e as Error).message ?? "Errore");
            }
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}

function PrezzoCard({
  prezzo,
  onDelete,
}: {
  prezzo: PrezzoProdotto;
  onDelete: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);

  async function showImage() {
    if (!prezzo.foto_scontrino) return;
    setLoadingImg(true);
    const { data } = await supabase.storage
      .from("scontrini")
      .createSignedUrl(prezzo.foto_scontrino, 3600);
    setSignedUrl(data?.signedUrl ?? null);
    setLoadingImg(false);
  }

  return (
    <div className="card-paper px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base text-paper-foreground">
            {prezzo.nome_prodotto}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-paper-foreground/70">
            <span className="rounded-sm bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground">
              {prezzo.supermercato}
            </span>
            <span className="tabular font-medium text-paper-foreground">
              {prezzo.prezzo.toFixed(2)} {prezzo.unita}
            </span>
            <span className="tabular">
              {new Date(prezzo.data_rilevazione).toLocaleDateString("it-IT")}
            </span>
            {prezzo.fonte === "scontrino" && <span>📷</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {prezzo.foto_scontrino && !signedUrl && (
            <button
              onClick={showImage}
              disabled={loadingImg}
              className="rounded-md p-1 text-paper-foreground/60 hover:text-primary"
            >
              <Camera className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded-md p-1 text-paper-foreground/40 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {signedUrl && (
        <div className="mt-2 overflow-hidden rounded-md border border-black/10">
          <img src={signedUrl} alt="scontrino" className="w-full" />
        </div>
      )}
    </div>
  );
}

type AddPayload = {
  nome: string;
  super: string;
  prezzo: number;
  unita: string;
  foto: File | null;
};

function AddPrezzoSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (p: AddPayload) => void;
}) {
  const [nome, setNome] = useState("");
  const [sup, setSup] = useState<string>("Lidl");
  const [prezzo, setPrezzo] = useState("");
  const [unita, setUnita] = useState<string>("€/pezzo");
  const [foto, setFoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-t-2xl bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">Nuovo prezzo</h2>
          <button onClick={onClose} className="rounded-md p-1 text-foreground/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Prodotto (es. latte intero 1L)"
            className="rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={prezzo}
              onChange={(e) => setPrezzo(e.target.value.replace(/[^0-9,.]/g, ""))}
              placeholder="0,00"
              className="tabular flex-1 rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={unita}
              onChange={(e) => setUnita(e.target.value)}
              className="rounded-md border border-border/60 bg-paper px-2 py-2 text-sm"
            >
              {UNITA_PREZZO.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {SUPERMERCATI.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSup(s)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium capitalize ${
                  sup === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 text-foreground/70"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground/70">
            <Camera className="h-4 w-4" />
            <span>{foto ? foto.name : "Allega foto (opzionale)"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button
            disabled={saving || !nome.trim() || !prezzo}
            onClick={async () => {
              setSaving(true);
              await onSubmit({
                nome: nome.trim(),
                super: sup,
                prezzo: parseFloat(prezzo.replace(",", ".")),
                unita,
                foto,
              });
              setSaving(false);
            }}
          >
            Salva
          </Button>
        </div>
      </div>
    </div>
  );
}
