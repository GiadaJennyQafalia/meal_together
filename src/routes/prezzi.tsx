import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Camera, X, Pencil, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  format,
  startOfWeek,
  startOfMonth,
  startOfYear,
  parseISO,
} from "date-fns";
import { it } from "date-fns/locale";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  addPrezzo,
  deletePrezzo,
  updatePrezzo,
  listPrezzi,
  listSpese,
  analizzaScontrinoPrezzi,
  importScontrinoInPrezzi,
  SUPERMERCATI,
  UNITA_PREZZO,
  type PrezzoProdotto,
  type SpesaScontrino,
} from "@/lib/prezzi.functions";

export const Route = createFileRoute("/prezzi")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Prezzi · Il Quaderno" },
      {
        name: "description",
        content: "Tracciamento prezzi per supermercato con foto scontrini condivise.",
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
  const upd = useServerFn(updatePrezzo);
  const analizza = useServerFn(analizzaScontrinoPrezzi);
  const importa = useServerFn(importScontrinoInPrezzi);
  const loadSpese = useServerFn(listSpese);

  const { data } = useQuery({ queryKey: ["prezzi"], queryFn: () => load() });
  const { data: spese } = useQuery({ queryKey: ["spese"], queryFn: () => loadSpese() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PrezzoProdotto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<string>("tutti");
  const [tab, setTab] = useState<"prezzi" | "dashboard">("prezzi");
  const [analisi, setAnalisi] = useState<{
    path: string;
    supermercato: string;
    data: string | null;
    totale: number | null;
    prodotti: { nome: string; quantita: number; prezzo: number; unita: string | null }[];
  } | null>(null);


  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prezzi"] });
    qc.invalidateQueries({ queryKey: ["spese"] });
  };

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: invalidate,
  });
  const updM = useMutation({
    mutationFn: (p: { id: string; nome: string; super: string; prezzo: number; unita: string }) =>
      upd({
        data: {
          id: p.id,
          nome_prodotto: p.nome,
          supermercato: p.super,
          prezzo: p.prezzo,
          unita: p.unita,
        },
      }),
    onSuccess: () => {
      toast.success("Prezzo aggiornato");
      invalidate();
      setEditing(null);
    },
    onError: (e) => toast.error((e as Error).message ?? "Errore"),
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

  async function onScontrino(file: File) {
    const path = await uploadScontrino(file);
    if (!path) return;
    setUploading(true);
    try {
      const res = await analizza({ data: { scontrino_path: path } });
      if (res.prodotti.length === 0) {
        toast.error("Nessun prodotto riconosciuto nello scontrino");
        return;
      }
      setAnalisi({ path, ...res });
    } catch (e) {
      toast.error((e as Error).message ?? "Analisi scontrino fallita");
    } finally {
      setUploading(false);
    }
  }

  const importM = useMutation({
    mutationFn: (payload: {
      scontrino_path: string;
      supermercato: string;
      data: string | null;
      totale: number | null;
      prodotti: { nome: string; prezzo: number; unita: string | null }[];
    }) => importa({ data: payload }),
    onSuccess: (res) => {
      toast.success(`Salvati ${res.prodotti.length} prezzi`);
      setAnalisi(null);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message ?? "Errore"),
  });

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground">
      <AppHeader
        title="Prezzi"
        subtitle={uploading ? "Analisi scontrino…" : `${data?.length ?? 0} rilevazioni`}
        right={
          <div className="flex gap-1.5">
            <label
             htmlFor="scontrino-upload-prezzi"
             aria-disabled={uploading}
             className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-[11px] uppercase tracking-wider text-foreground/70 hover:bg-muted/40 aria-disabled:opacity-50 aria-disabled:pointer-events-none"
           >
            <Camera className="h-3 w-3" />
            Scontrino
          </label>
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
        id="scontrino-upload-prezzi"
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
        <div className="mb-3 flex gap-2">
          {(["prezzi", "dashboard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${
                tab === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 text-foreground/70"
              }`}
            >
              {t === "prezzi" ? "Prezzi" : "Dashboard spesa"}
            </button>
          ))}
        </div>

        {tab === "dashboard" ? (
          <DashboardSpesa spese={spese ?? []} />
        ) : (
        <>
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
          <p className="mt-10 text-center text-sm text-muted-foreground">Nessun prezzo salvato.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {filtered.map((p) => (
              <li key={p.id}>
                <PrezzoCard
                  prezzo={p}
                  onDelete={() => delM.mutate(p.id)}
                  onEdit={() => setEditing(p)}
                />
              </li>
            ))}
          </ul>
        )}
        </>
        )}
      </div>

      {analisi && (
        <AnteprimaScontrino
          analisi={analisi}
          saving={importM.isPending}
          onClose={() => setAnalisi(null)}
          onConfirm={(payload) =>
            importM.mutate({ scontrino_path: analisi.path, ...payload })
          }
        />
      )}

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
      {editing && (
        <AddPrezzoSheet
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            updM.mutate({
              id: editing.id,
              nome: payload.nome,
              super: payload.super,
              prezzo: payload.prezzo,
              unita: payload.unita,
            });
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
  onEdit,
}: {
  prezzo: PrezzoProdotto;
  onDelete: () => void;
  onEdit: () => void;
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

type RigaEstratta = { nome: string; quantita: number; prezzo: number; unita: string | null };

type AnteprimaPayload = {
  supermercato: string;
  data: string | null;
  totale: number | null;
  prodotti: { nome: string; prezzo: number; unita: string | null }[];
};

function AnteprimaScontrino({
  analisi,
  saving,
  onClose,
  onConfirm,
}: {
  analisi: AnteprimaPayload & { path: string };
  saving: boolean;
  onClose: () => void;
  onConfirm: (p: AnteprimaPayload) => void;
}) {
  const [sup, setSup] = useState(analisi.supermercato);
  const [dataAcq, setDataAcq] = useState(
    analisi.data ?? new Date().toISOString().slice(0, 10),
  );
  const [righe, setRighe] = useState<RigaEstratta[]>(analisi.prodotti);

  const totale = righe.reduce((s, r) => s + (Number.isFinite(r.prezzo) ? r.prezzo : 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">Controlla lo scontrino</h2>
          <button onClick={onClose} className="rounded-md p-1 text-foreground/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={sup}
            onChange={(e) => setSup(e.target.value)}
            className="rounded-md border border-border/60 bg-paper px-2 py-1.5 text-sm"
          >
            {SUPERMERCATI.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dataAcq}
            onChange={(e) => setDataAcq(e.target.value)}
            className="tabular rounded-md border border-border/60 bg-paper px-2 py-1.5 text-sm"
          />
        </div>

<ul className="flex flex-col gap-2">
          {righe.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <input
                  value={r.nome}
                  onChange={(e) =>
                    setRighe((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)),
                    )
                  }
                  className="w-full rounded-md border border-border/60 bg-paper px-2 py-1.5 text-sm text-paper-foreground"
                />
                {r.quantita !== 1 && (
                  <span className="ml-0.5 mt-0.5 block text-[10px] text-foreground/50">
                    ×{r.quantita} sullo scontrino — prezzo già diviso per unità
                  </span>
                )}
              </div>
              <PrezzoRigaInput
                value={r.prezzo}
                onChange={(v) =>
                  setRighe((prev) => prev.map((x, j) => (j === i ? { ...x, prezzo: v } : x)))
                }
              />
              <button
                onClick={() => setRighe((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-md p-1 text-foreground/40 hover:text-destructive"
                aria-label="Rimuovi riga"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-foreground/70">{righe.length} prodotti</span>
          <span className="tabular font-medium">Totale {totale.toFixed(2)} €</span>
        </div>

        <Button
          className="mt-3 w-full"
          disabled={saving || righe.length === 0}
          onClick={() =>
            onConfirm({
              supermercato: sup,
              data: dataAcq,
              totale: Math.round(totale * 100) / 100,
              prodotti: righe
                .filter((r) => r.nome.trim())
                .map((r) => ({ nome: r.nome, prezzo: r.prezzo, unita: r.unita })),
            })
          }
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferma e salva"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Input prezzo con stato di digitazione locale, separato dal valore numerico.
 * Evita il bug per cui virgola/punto venivano cancellati ad ogni tasto premuto.
 */
function PrezzoRigaInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value).replace(".", ","));

  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9,]/g, "");
        setText(raw);
        const num = parseFloat(raw.replace(",", "."));
        onChange(Number.isFinite(num) ? num : 0);
      }}
      className="tabular w-20 rounded-md border border-border/60 bg-paper px-2 py-1.5 text-sm text-paper-foreground"
    />
  );
}
const COLORI_SUPER: Record<string, string> = {
  Lidl: "#19350C",
  Aldi: "#687D31",
  Eurospar: "#A8A093",
  dm: "#C4703A",
  altro: "#8B8B7A",
};

function DashboardSpesa({ spese }: { spese: SpesaScontrino[] }) {
  const [periodo, setPeriodo] = useState<"settimana" | "mese" | "anno">("mese");

const { rows, supermercati, totale, nScontrini, totalePeriodoLabel } = useMemo(() => {
  const bucket = new Map<string, Record<string, number>>();
  const sups = new Set<string>();

  const startOfCurrent =
    periodo === "settimana"
      ? startOfWeek(new Date(), { weekStartsOn: 1 })
      : periodo === "mese"
        ? startOfMonth(new Date())
        : startOfYear(new Date());
  const currentKey = format(startOfCurrent, "yyyy-MM-dd");
  let sommaPeriodoCorrente = 0;
  let nScontriniPeriodoCorrente = 0;

  for (const s of spese) {
    if (s.totale == null) continue;
    const d = parseISO(s.data_acquisto);
    const start =
      periodo === "settimana"
        ? startOfWeek(d, { weekStartsOn: 1 })
        : periodo === "mese"
          ? startOfMonth(d)
          : startOfYear(d);
    const label =
      periodo === "settimana"
        ? format(start, "d MMM", { locale: it })
        : periodo === "mese"
          ? format(start, "MMM yy", { locale: it })
          : format(start, "yyyy");
    const key = `${format(start, "yyyy-MM-dd")}|${label}`;
    const cur = bucket.get(key) ?? {};
    cur[s.supermercato] = (cur[s.supermercato] ?? 0) + s.totale;
    bucket.set(key, cur);
    sups.add(s.supermercato);
    if (format(start, "yyyy-MM-dd") === currentKey) {
      sommaPeriodoCorrente += s.totale;
      nScontriniPeriodoCorrente += 1;
    }
  }
  const rows = Array.from(bucket.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => ({ periodo: key.split("|")[1], ...vals }));

  const label =
    periodo === "settimana"
      ? "Totale questa settimana"
      : periodo === "mese"
        ? "Totale questo mese"
        : "Totale quest'anno";

  return {
    rows,
    supermercati: Array.from(sups),
    totale: sommaPeriodoCorrente,
    nScontrini: nScontriniPeriodoCorrente,
    totalePeriodoLabel: label,
  };
}, [spese, periodo]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(["settimana", "mese", "anno"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${
              periodo === p
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 text-foreground/70"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

<div className="card-paper px-4 py-3">
  <p className="text-[11px] uppercase tracking-wider text-paper-foreground/60">
    {totalePeriodoLabel}
  </p>
  <p className="tabular font-serif text-2xl text-paper-foreground">
    {totale.toFixed(2)} €
  </p>
  <p className="text-[12px] text-paper-foreground/60">{nScontrini} scontrini</p>
  </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nessuna spesa registrata. Carica uno scontrino per iniziare.
        </p>
      ) : (
        <div className="card-paper h-72 px-2 py-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
              <XAxis dataKey="periodo" fontSize={11} />
              <YAxis fontSize={11} width={38} />
              <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)} €`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {supermercati.map((s) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="spesa"
                  fill={COLORI_SUPER[s] ?? "#8B8B7A"}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function AddPrezzoSheet({
  onClose,
  onSubmit,
  initial,
}: {
  onClose: () => void;
  onSubmit: (p: AddPayload) => void;
  initial?: PrezzoProdotto | null;
}) {
  const [nome, setNome] = useState(initial?.nome_prodotto ?? "");
  const [sup, setSup] = useState<string>(initial?.supermercato ?? "Lidl");
  const [prezzo, setPrezzo] = useState(initial ? String(initial.prezzo).replace(".", ",") : "");
  const [unita, setUnita] = useState<string>(initial?.unita ?? "€/pezzo");
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
