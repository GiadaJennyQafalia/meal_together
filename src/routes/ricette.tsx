import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Flame, Snowflake, Star, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { listRicette, type Ricetta } from "@/lib/ricette.functions";

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
  const [filter, setFilter] = useState<"tutte" | "rifare" | "cena" | "pane">("tutte");

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

        {isLoading ? (
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