import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Clock,
  Flame,
  Snowflake,
  Star,
  ChevronRight,
  Plus,
  ExternalLink,
  Trash2,
  ArrowUpRight,
  X,
  Settings,
  ArrowLeft,
  FolderPlus,
  Pencil,
  ImageIcon,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useSignedImage } from "@/lib/signed-image";
import { supabase } from "@/integrations/supabase/client";
import {
  listRicette,
  listCartelle,
  createCartella,
  renameCartella,
  deleteCartella,
  updateCartella,
  type Ricetta,
  type Cartella,
} from "@/lib/ricette.functions";
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
          "Il ricettario condiviso di Giada e Francesco, organizzato in cartelle con tag e foto di copertina.",
      },
    ],
  }),
  component: RicettePage,
});

type View =
  | { kind: "cartelle" }
  | { kind: "cartella"; id: string }
  | { kind: "rifare" }
  | { kind: "daprovare" };

function RicettePage() {
  const loadR = useServerFn(listRicette);
  const loadC = useServerFn(listCartelle);
  const { data: ricette } = useQuery({
    queryKey: ["ricette"],
    queryFn: () => loadR(),
  });
  const { data: cartelle } = useQuery({
    queryKey: ["cartelle"],
    queryFn: () => loadC(),
  });

  const [view, setView] = useState<View>({ kind: "cartelle" });
  const [manage, setManage] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const rows = ricette ?? [];
  const folders = cartelle ?? [];

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground">
      <AppHeader
        title="Ricettario"
        subtitle={
          view.kind === "cartelle"
            ? `${folders.length} cartelle · ${rows.length} schede`
            : view.kind === "cartella"
              ? folders.find((f) => f.id === view.id)?.nome ?? "Cartella"
              : view.kind === "rifare"
                ? "Da rifare"
                : "Da provare"
        }
      />

      <div className="mx-auto max-w-xl px-4 pt-4">
        <div className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-3">
          <Tab
            active={view.kind === "cartelle" || view.kind === "cartella"}
            onClick={() => {
              setView({ kind: "cartelle" });
              setTagFilter(null);
            }}
          >
            Cartelle
          </Tab>
          <Tab
            active={view.kind === "rifare"}
            onClick={() => setView({ kind: "rifare" })}
          >
            Da rifare
          </Tab>
          <Tab
            active={view.kind === "daprovare"}
            onClick={() => setView({ kind: "daprovare" })}
          >
            Da provare
          </Tab>
          {view.kind === "cartelle" && (
            <button
              onClick={() => setManage(true)}
              className="ml-auto shrink-0 rounded-full border border-border/60 p-2 text-foreground/70 hover:bg-muted/40"
              aria-label="Gestisci cartelle"
              title="Gestisci cartelle"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          {view.kind === "cartella" && (
            <button
              onClick={() => {
                setView({ kind: "cartelle" });
                setTagFilter(null);
              }}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/40"
            >
              <ArrowLeft className="h-3 w-3" />
              Cartelle
            </button>
          )}
        </div>

        {view.kind === "cartelle" && (
          <CartelleGrid
            cartelle={folders}
            ricette={rows}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            onOpen={(id) => setView({ kind: "cartella", id })}
          />
        )}

        {view.kind === "cartella" && (
          <CartellaDetail
            cartella={folders.find((f) => f.id === view.id)}
            ricette={rows.filter((r) => r.cartella_id === view.id)}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
          />
        )}

        {view.kind === "rifare" && (
          <SimpleList ricette={rows.filter((r) => r.da_rifare)} />
        )}

        {view.kind === "daprovare" && <DaProvareList />}
      </div>

      {manage && (
        <ManageCartelleSheet
          cartelle={folders}
          ricette={rows}
          onClose={() => setManage(false)}
        />
      )}

      <Outlet />
      <BottomNav />
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/60 bg-transparent text-foreground/80 hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}

function CartelleGrid({
  cartelle,
  ricette,
  tagFilter,
  setTagFilter,
  onOpen,
}: {
  cartelle: Cartella[];
  ricette: Ricetta[];
  tagFilter: string | null;
  setTagFilter: (t: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const allTags = useMemo(() => {
    const set = new Set<string>();
    ricette.forEach((r) => (r.tag ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [ricette]);

  const matches = (r: Ricetta) =>
    !tagFilter || (r.tag ?? []).includes(tagFilter);

  const foldersToShow = tagFilter
    ? cartelle.filter((c) =>
        ricette.some((r) => r.cartella_id === c.id && matches(r)),
      )
    : cartelle;

  const orphans = ricette.filter((r) => !r.cartella_id && matches(r));
  return (
    <>
      {allTags.length > 0 && (
        <div className="scrollbar-none -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <button
            onClick={() => setTagFilter(null)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
              !tagFilter
                ? "border-foreground bg-foreground text-background"
                : "border-border/60 text-foreground/70"
            }`}
          >
            tutti i tag
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t === tagFilter ? null : t)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
                t === tagFilter
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/60 text-foreground/70"
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {foldersToShow.map((c) => {
          const inside = ricette.filter(
            (r) => r.cartella_id === c.id && matches(r),
          );
          const derived = inside.find((r) => r.immagine_url)?.immagine_url ?? null;
          const cover = c.immagine_url ?? derived;
          return (
            <CartellaTile
              key={c.id}
              nome={c.nome}
              cover={cover}
              count={inside.length}
              onClick={() => onOpen(c.id)}
            />
          );
        })}
      </div>
      {orphans.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            Senza cartella ({orphans.length})
          </p>
          <ul className="flex flex-col gap-2.5">
            {orphans.map((r) => (
              <li key={r.id}>
                <RicettaCard ricetta={r} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {foldersToShow.length === 0 && orphans.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {tagFilter
            ? `Nessuna ricetta con #${tagFilter}.`
            : "Nessuna cartella. Creane una con l'ingranaggio in alto."}
        </p>
      )}
    </>
  );
}

function CartellaTile({
  nome,
  cover,
  count,
  onClick,
}: {
  nome: string;
  cover: string | null;
  count: number;
  onClick: () => void;
}) {
  const src = useSignedImage(cover);
  return (
    <button
      onClick={onClick}
      className="card-paper group relative aspect-square overflow-hidden text-left"
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform group-active:scale-[0.98]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/40 to-muted/30" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <p className="font-serif text-base leading-tight">{nome}</p>
        <p className="mt-0.5 text-[11px] opacity-80">
          {count} {count === 1 ? "ricetta" : "ricette"}
        </p>
      </div>
    </button>
  );
}

function CartellaDetail({
  cartella,
  ricette,
  tagFilter,
  setTagFilter,
}: {
  cartella: Cartella | undefined;
  ricette: Ricetta[];
  tagFilter: string | null;
  setTagFilter: (t: string | null) => void;
}) {
  const tags = useMemo(() => {
    const set = new Set<string>();
    ricette.forEach((r) => (r.tag ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [ricette]);

  const filtered = tagFilter
    ? ricette.filter((r) => (r.tag ?? []).includes(tagFilter))
    : ricette;

  if (!cartella) {
    return (
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Cartella non trovata.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tags.length > 0 && (
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <button
            onClick={() => setTagFilter(null)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
              !tagFilter
                ? "border-foreground bg-foreground text-background"
                : "border-border/60 text-foreground/70"
            }`}
          >
            tutti
          </button>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t === tagFilter ? null : t)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
                t === tagFilter
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/60 text-foreground/70"
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}
      <SimpleList ricette={filtered} />
    </div>
  );
}

function SimpleList({ ricette }: { ricette: Ricetta[] }) {
  if (ricette.length === 0) {
    return (
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Nessuna ricetta qui.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {ricette.map((r) => (
        <li key={r.id}>
          <RicettaCard ricetta={r} />
        </li>
      ))}
    </ul>
  );
}

function ManageCartelleSheet({
  cartelle,
  ricette,
  onClose,
}: {
  cartelle: Cartella[];
  ricette: Ricetta[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createCartella);
  const rename = useServerFn(renameCartella);
  const del = useServerFn(deleteCartella);
  const [nome, setNome] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cartelle"] });
    qc.invalidateQueries({ queryKey: ["ricette"] });
  };

  const createM = useMutation({
    mutationFn: (n: string) => create({ data: { nome: n } }),
    onSuccess: () => {
      setNome("");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message ?? "Errore"),
  });

  const renameM = useMutation({
    mutationFn: (p: { id: string; nome: string }) => rename({ data: p }),
    onSuccess: invalidate,
    onError: (e) => toast.error((e as Error).message ?? "Errore"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Cartella eliminata");
    },
    onError: (e) => toast.error((e as Error).message ?? "Errore"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-t-2xl bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">Gestisci cartelle</h2>
          <button onClick={onClose} className="rounded-md p-1 text-foreground/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nuova cartella"
            className="flex-1 rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            disabled={!nome.trim() || createM.isPending}
            onClick={() => createM.mutate(nome.trim())}
            className="gap-1"
          >
            <FolderPlus className="h-4 w-4" />
            Aggiungi
          </Button>
        </div>

        <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {cartelle.map((c) => {
            const count = ricette.filter((r) => r.cartella_id === c.id).length;
            return (
              <ManageRow
                key={c.id}
                cartella={c}
                count={count}
                onRename={(nome) => renameM.mutate({ id: c.id, nome })}
                onDelete={() => {
                  if (count > 0) {
                    toast.error("Sposta prima le ricette dentro un'altra cartella.");
                    return;
                  }
                  delM.mutate(c.id);
                }}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ManageRow({
  cartella,
  count,
  onRename,
  onDelete,
}: {
  cartella: Cartella;
  count: number;
  onRename: (nome: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(cartella.nome);
  return (
    <li className="flex items-center gap-2 rounded-md border border-border/40 bg-paper/60 px-3 py-2">
      {editing ? (
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="flex-1 rounded-md border border-border/60 bg-background px-2 py-1 text-sm text-foreground"
          autoFocus
        />
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-sm text-paper-foreground">
            {cartella.nome}
          </p>
          <p className="text-[11px] text-paper-foreground/60">
            {count} {count === 1 ? "ricetta" : "ricette"}
          </p>
        </div>
      )}
      {editing ? (
        <>
          <button
            onClick={() => {
              if (val.trim() && val.trim() !== cartella.nome) {
                onRename(val.trim());
              }
              setEditing(false);
            }}
            className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
          >
            OK
          </button>
          <button
            onClick={() => {
              setVal(cartella.nome);
              setEditing(false);
            }}
            className="rounded-md p-1 text-paper-foreground/60"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => setEditing(true)}
            className="rounded-md p-1 text-paper-foreground/60 hover:text-foreground"
            aria-label="Rinomina"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className={`rounded-md p-1 ${
              count > 0
                ? "text-paper-foreground/30"
                : "text-paper-foreground/60 hover:text-destructive"
            }`}
            aria-label="Elimina"
            title={count > 0 ? "Sposta prima le ricette" : "Elimina"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </li>
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
    onSuccess: () => {
      toast.success("Aggiunta al ricettario");
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
            placeholder="Titolo"
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
      className="card-paper block overflow-hidden transition-transform active:scale-[0.99]"
    >
      <div className="flex items-stretch gap-3">
        <div className="relative h-[86px] w-[86px] shrink-0 bg-muted/40">
          {ricetta.immagine_url ? (
            <img
              src={ricetta.immagine_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-paper-foreground/30">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3 pr-3">
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
            <h3 className="mt-1 truncate font-serif text-base font-medium text-paper-foreground">
              {ricetta.titolo}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-paper-foreground/70">
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
            {(ricetta.tag ?? []).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {(ricetta.tag ?? []).slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-paper-foreground/70"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-paper-foreground/50" />
        </div>
      </div>
    </Link>
  );
}
