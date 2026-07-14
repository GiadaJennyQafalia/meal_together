import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Flame, Snowflake, Star, ChevronRight, Plus, ExternalLink, Trash2, ArrowUpRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { listRicette, type Ricetta } from "@/lib/ricette.functions";
import {
  addDaProvare,
  deleteDaProvare,
  listDaProvare,
  promuoviDaProvare,
  type DaProvare,
} from "@/lib/daprovare.functions";

export const Route = createFileRoute("/ricette")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ricettario · Il Quaderno" },
      {
        name: "description",
        content:
          "Il ricettario condiviso di Giada e Francesco: 13 ricette con voti, note e varianti.",
      },
    ],
  }),
  component: RicettePage,
});

function RicettePage() {
  const load = useServerFn(listRicette);
  const { data, isLoading } = useQuery({
    queryKey: ["ricette"],
    queryFn: () => load(),
  });
  const [filter, setFilter] = useState<
    "tutte" | "rifare" | "cena" | "pane" | "daprovare"
  >("tutte");

  const items = useMemo(() => {
    const rows = data ?? [];
    if (filter === "rifare") return rows.filter((r) => r.da_rifare);
    if (filter === "cena") return rows.filter((r) => r.categoria === "Cena");
    if (filter === "pane")
      return rows.filter((r) => r.categoria === "Pane" || r.categoria === "Base");
    return rows;
  }, [data, filter]);

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground">
      <AppHeader title="Ricettario" subtitle={`${data?.length ?? 0} schede`} />

      <div className="mx-auto max-w-xl px-4 pt-4">
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
          {[
            ["tutte", "Tutte"],
            ["rifare", "Da rifare"],
            ["cena", "Cene"],
            ["pane", "Pane & basi"],
            ["daprovare", "Da provare"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id as typeof filter)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                filter === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-transparent text-foreground/80 hover:bg-muted/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filter === "daprovare" ? (
          <DaProvareList />
        ) : isLoading ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Sfoglio le schede…
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((r) => (
              <li key={r.id}>
                <RicettaCard ricetta={r} />
              </li>
            ))}
            {items.length === 0 && (
              <p className="mt-8 text-center text-sm text-muted-foreground">
                Nessuna ricetta corrisponde a questo filtro.
              </p>
            )}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function DaProvareList() {
  const qc = useQueryClient();
  const load = useServerFn(listDaProvare);
  const add = useServerFn(addDaProvare);
  const del = useServerFn(deleteDaProvare);
  const prom = useServerFn(promuoviDaProvare);

  const { data, isLoading } = useQuery({
    queryKey: ["daprovare"],
    queryFn: () => load(),
  });

  const [open, setOpen] = useState(false);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["daprovare"] });
    qc.invalidateQueries({ queryKey: ["ricette"] });
  };

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: invalidate,
  });
  const promM = useMutation({
    mutationFn: (id: string) => prom({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Aggiunta al ricettario: ${r.ricetta_id}`);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message ?? "Errore"),
  });

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setOpen(true)}
        className="card-paper flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-primary"
      >
        <Plus className="h-4 w-4" />
        Aggiungi link video
      </button>

      {isLoading ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">Carico…</p>
      ) : (data ?? []).length === 0 ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Nessun link salvato. Aggiungi TikTok, Instagram o Facebook che vuoi provare.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {(data ?? []).map((r) => (
            <li key={r.id}>
              <DaProvareCard
                item={r}
                onDelete={() => delM.mutate(r.id)}
                onPromote={() => promM.mutate(r.id)}
                promoting={promM.isPending}
              />
            </li>
          ))}
        </ul>
      )}

      {open && (
        <AddDaProvareSheet
          onClose={() => setOpen(false)}
          onSubmit={async (p) => {
            try {
              await add({ data: p });
              toast.success("Aggiunto");
              invalidate();
              setOpen(false);
            } catch (e) {
              toast.error((e as Error).message ?? "Errore");
            }
          }}
        />
      )}
    </div>
  );
}

function DaProvareCard({
  item,
  onDelete,
  onPromote,
  promoting,
}: {
  item: DaProvare;
  onDelete: () => void;
  onPromote: () => void;
  promoting: boolean;
}) {
  return (
    <div className="card-paper px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.stato === "provata" && (
              <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                Provata
              </span>
            )}
          </div>
          <p className="mt-1 font-serif text-base text-paper-foreground">
            {item.titolo}
          </p>
          {item.link_video && (
            <a
              href={item.link_video}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[12px] text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Apri video
            </a>
          )}
          {item.note && (
            <p className="mt-1.5 whitespace-pre-wrap text-[12px] text-paper-foreground/70">
              {item.note}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={onPromote}
            disabled={promoting || item.stato === "provata"}
            title="Promuovi al ricettario"
            className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] text-foreground/80 hover:bg-muted/40 disabled:opacity-40"
          >
            <ArrowUpRight className="h-3 w-3" />
            Ricettario
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

function AddDaProvareSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (p: { titolo: string; link_video: string; note: string }) => void;
}) {
  const [titolo, setTitolo] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-t-2xl bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">Nuovo link video</h2>
          <button onClick={onClose} className="rounded-md p-1 text-foreground/60">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            placeholder="Titolo (es. Pasta al limone di ...)"
            className="rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link TikTok / Instagram / Facebook"
            className="rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note / varianti / adattamenti"
            rows={4}
            className="rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            disabled={saving || !titolo.trim()}
            onClick={async () => {
              setSaving(true);
              await onSubmit({
                titolo: titolo.trim(),
                link_video: link.trim(),
                note: note.trim(),
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

function RicettaCard({ ricetta }: { ricetta: Ricetta }) {
  return (
    <Link
      to="/ricette/$id"
      params={{ id: ricetta.id }}
      className="card-paper block px-4 py-3.5 transition-transform active:scale-[0.99]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {ricetta.categoria ? (
              <span className="rounded-sm bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground">
                {ricetta.categoria}
              </span>
            ) : null}
            {ricetta.da_rifare ? (
              <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                Da rifare
              </span>
            ) : null}
          </div>
          <h3 className="mt-1.5 truncate font-serif text-lg font-medium text-paper-foreground">
            {ricetta.titolo}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-paper-foreground/70">
            {ricetta.voto != null && (
              <span className="tabular inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-current" />
                {ricetta.voto}/10
              </span>
            )}
            {ricetta.tempo_minuti != null && (
              <span className="tabular inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {ricetta.tempo_minuti}′
              </span>
            )}
            {ricetta.kcal != null && (
              <span className="tabular inline-flex items-center gap-1">
                <Flame className="h-3 w-3" />
                {ricetta.kcal} kcal
              </span>
            )}
            {ricetta.congelabile && (
              <span className="inline-flex items-center gap-1">
                <Snowflake className="h-3 w-3" />
                cong.
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-paper-foreground/50" />
      </div>
    </Link>
  );
}