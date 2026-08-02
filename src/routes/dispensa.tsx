import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Minus, Trash2, Camera, X, Pencil, AlertTriangle, Receipt } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  addDispensa,
  deleteDispensa,
  importScontrinoInDispensa,
  listDispensa,
  suggerisciScadenza,
  updateDispensa,
  CATEGORIE_DISPENSA,
  type DispensaItem,
} from "@/lib/dispensa.functions";

export const Route = createFileRoute("/dispensa")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dispensa · Il Quaderno" },
      {
        name: "description",
        content:
          "Cosa c'è in frigo, freezer e dispensa: gestione condivisa con scadenze e import da scontrino.",
      },
    ],
  }),
  component: DispensaPage,
});

function giorniAScadenza(scadenza: string | null): number | null {
  if (!scadenza) return null;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const s = new Date(scadenza + "T00:00:00");
  return Math.round((s.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
}

function DispensaPage() {
  const qc = useQueryClient();
  const load = useServerFn(listDispensa);
  const add = useServerFn(addDispensa);
  const upd = useServerFn(updateDispensa);
  const del = useServerFn(deleteDispensa);
  const importa = useServerFn(importScontrinoInDispensa);

  const { data } = useQuery({ queryKey: ["dispensa"], queryFn: () => load() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DispensaItem | null>(null);
  const [filter, setFilter] = useState<string>("tutti");
  const [uploading, setUploading] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dispensa"] });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: invalidate,
  });

  const stepM = useMutation({
    mutationFn: (p: { id: string; quantita: number }) =>
      upd({ data: { id: p.id, patch: { quantita: p.quantita } } }),
    onSuccess: invalidate,
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (filter === "tutti") return rows;
    if (filter === "scadenza") {
      return rows.filter((r) => {
        const g = giorniAScadenza(r.scadenza);
        return g !== null && g <= 3;
      });
    }
    return rows.filter((r) => r.categoria === filter);
  }, [data, filter]);

  async function onScontrino(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `dispensa/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("scontrini")
        .upload(path, file, { upsert: false });
      if (error) throw error;

      const res = await importa({ data: { scontrino_path: path } });
      const totale = res.aggiunti + res.aggiornati;
      if (totale === 0) {
        toast.warning("Nessun prodotto riconosciuto dallo scontrino");
      } else {
        toast.success(`${res.aggiunti} nuovi · ${res.aggiornati} aggiornati dallo scontrino`);
      }
      invalidate();
    } catch (e) {
      toast.error((e as Error).message ?? "Errore import scontrino");
    } finally {
      setUploading(false);
    }
  }

  const scadendo = (data ?? []).filter((r) => {
    const g = giorniAScadenza(r.scadenza);
    return g !== null && g <= 3;
  }).length;

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground">
      <AppHeader
        title="Dispensa"
        subtitle={`${data?.length ?? 0} voci${scadendo ? ` · ${scadendo} in scadenza` : ""}`}
        right={
          <div className="flex gap-1.5">
            <label
              htmlFor="scontrino-upload-dispensa"
              aria-disabled={uploading}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-[11px] uppercase tracking-wider text-foreground/70 hover:bg-muted/40 aria-disabled:opacity-50 aria-disabled:pointer-events-none"
            >
              <Camera className="h-3 w-3" />
              {uploading ? "…" : "Scontrino"}
            </label>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] uppercase tracking-wider text-primary-foreground"
            >
              <Plus className="h-3 w-3" />
              Aggiungi
            </button>
          </div>
        }
      />
      <input
       id="scontrino-upload-dispensa"
       type="file"
       accept="image/*"
       capture="environment"
       className="absolute h-px w-px overflow-hidden opacity-0"
       onChange={(e) => {
         const f = e.target.files?.[0];
         if (f) onScontrino(f);
         e.target.value = "";
       }}
     />

      <div className="mx-auto max-w-xl px-4 pt-4">
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
          {(["tutti", "scadenza", ...CATEGORIE_DISPENSA] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize tracking-wide transition-colors ${
                filter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-transparent text-foreground/80 hover:bg-muted/40"
              }`}
            >
              {s === "scadenza" ? "In scadenza" : s}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {filter === "tutti"
              ? "Dispensa vuota. Aggiungi una voce o carica uno scontrino."
              : "Nessuna voce in questa categoria."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {filtered.map((r) => (
              <li key={r.id}>
                <DispensaCard
                  item={r}
                  onDelete={() => delM.mutate(r.id)}
                  onEdit={() => setEditing(r)}
                  onStep={(delta) =>
                    stepM.mutate({ id: r.id, quantita: Math.max(0, (r.quantita ?? 0) + delta) })
                  }
                  stepping={stepM.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <DispensaSheet
          onClose={() => setOpen(false)}
          onSubmit={async (payload) => {
            try {
              await add({ data: payload });
              toast.success("Aggiunto in dispensa");
              invalidate();
              setOpen(false);
            } catch (e) {
              toast.error((e as Error).message ?? "Errore");
            }
          }}
        />
      )}
      {editing && (
        <DispensaSheet
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            try {
              await upd({ data: { id: editing.id, patch: payload } });
              toast.success("Aggiornato");
              invalidate();
              setEditing(null);
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

function DispensaCard({
  item,
  onDelete,
  onEdit,
  onStep,
  stepping,
}: {
  item: DispensaItem;
  onDelete: () => void;
  onEdit: () => void;
  onStep: (delta: 1 | -1) => void;
  stepping: boolean;
}) {
  const g = giorniAScadenza(item.scadenza);
  const inScadenza = g !== null && g <= 3;
  const scaduto = g !== null && g < 0;

  // Quantità = numero confezioni, Peso = peso di UNA confezione.
  const pesoLabel =
    item.peso != null
      ? item.quantita != null
        ? `× ${item.peso}g/conf. · ${item.quantita * item.peso}g tot.`
        : `${item.peso}g/conf.`
      : null;
  const unitaLabel = item.unita ? ` ${item.unita}` : "";

  return (
    <div className="card-paper px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base text-paper-foreground">
            {item.nome_ingrediente}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-paper-foreground/70">
            <span className="rounded-sm bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground">
              {item.categoria}
            </span>
            {pesoLabel && <span className="tabular">{pesoLabel}</span>}
            {item.scadenza && (
              <span
                className={`tabular inline-flex items-center gap-1 ${
                  scaduto
                    ? "text-destructive font-semibold"
                    : inScadenza
                      ? "text-amber-700 font-semibold"
                      : ""
                }`}
              >
                {inScadenza && <AlertTriangle className="h-3 w-3" />}
                {scaduto
                  ? `Scaduto ${Math.abs(g!)}g fa`
                  : g === 0
                    ? "Scade oggi"
                    : g === 1
                      ? "Scade domani"
                      : `Scade tra ${g}g`}
              </span>
            )}
            {item.fonte === "scontrino" && (
              <span
                title="Aggiunto leggendo uno scontrino"
                className="inline-flex items-center gap-1 text-[11px] text-paper-foreground/50"
              >
                <Receipt className="h-3 w-3" />
                da scontrino
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={stepping || (item.quantita ?? 0) <= 0}
              aria-label="Togli una confezione"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/60 text-paper-foreground/70 hover:bg-muted/40 disabled:opacity-30"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="tabular min-w-[2ch] text-center text-sm font-medium text-paper-foreground">
              {item.quantita ?? 0}
              {unitaLabel}
            </span>
            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={stepping}
              aria-label="Aggiungi una confezione"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/60 text-paper-foreground/70 hover:bg-muted/40 disabled:opacity-30"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="rounded-md p-1 text-paper-foreground/40 hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1 text-paper-foreground/40 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

type SheetPayload = {
  nome_ingrediente: string;
  quantita: number | null;
  unita: string | null;
  peso: number | null;
  categoria: (typeof CATEGORIE_DISPENSA)[number];
  scadenza: string | null;
  fonte: "manuale" | "scontrino";
};

function DispensaSheet({
  onClose,
  onSubmit,
  initial,
}: {
  onClose: () => void;
  onSubmit: (p: SheetPayload) => void;
  initial?: DispensaItem | null;
}) {
  const [nome, setNome] = useState(initial?.nome_ingrediente ?? "");
  const [qty, setQty] = useState(initial?.quantita != null ? String(initial.quantita) : "");
  const [unita, setUnita] = useState(initial?.unita ?? "");
  const [peso, setPeso] = useState(initial?.peso != null ? String(initial.peso) : "");
  const [categoria, setCategoria] = useState<(typeof CATEGORIE_DISPENSA)[number]>(
    (initial?.categoria as (typeof CATEGORIE_DISPENSA)[number]) ?? "altro",
  );
  const [scadenza, setScadenza] = useState<string>(
    initial?.scadenza ?? suggerisciScadenza("altro"),
  );
  const [scadenzaTocca, setScadenzaTocca] = useState(!!initial?.scadenza);
  const [saving, setSaving] = useState(false);

  function onCategoria(c: (typeof CATEGORIE_DISPENSA)[number]) {
    setCategoria(c);
    if (!scadenzaTocca) setScadenza(suggerisciScadenza(c));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-t-2xl bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">
            {initial ? "Modifica voce" : "Nuova voce dispensa"}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-foreground/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ingrediente (es. yogurt greco)"
            className="rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^0-9,.]/g, ""))}
                placeholder="Confezioni"
                className="tabular flex-1 rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground"
              />
              <input
                value={unita}
                onChange={(e) => setUnita(e.target.value)}
                placeholder="Unità"
                className="w-24 rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground"
              />
              <input
                inputMode="decimal"
                value={peso}
                onChange={(e) => setPeso(e.target.value.replace(/[^0-9,.]/g, ""))}
                placeholder="Peso/conf. (g)"
                className="tabular w-28 rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground"
              />
            </div>
            <p className="mt-1 text-[11px] text-foreground/50">
              Confezioni = quante ne hai (es. 2). Peso/conf. = quanto pesa
              <strong> una sola</strong> confezione (es. 400g) — non il totale.
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-foreground/60">
              Categoria
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIE_DISPENSA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCategoria(c)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium capitalize ${
                    categoria === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 text-foreground/70"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-foreground/60">
              Scadenza (suggerita in base alla categoria)
            </p>
            <input
              type="date"
              value={scadenza}
              onChange={(e) => {
                setScadenza(e.target.value);
                setScadenzaTocca(true);
              }}
              className="rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground"
            />
          </div>
          <Button
            disabled={saving || !nome.trim()}
            onClick={async () => {
              setSaving(true);
              await onSubmit({
                nome_ingrediente: nome.trim(),
                quantita: qty ? parseFloat(qty.replace(",", ".")) : null,
                unita: unita.trim() || null,
                peso: peso ? parseFloat(peso.replace(",", ".")) : null,
                categoria,
                scadenza: scadenza || null,
                fonte: initial?.fonte === "scontrino" ? "scontrino" : "manuale",
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
