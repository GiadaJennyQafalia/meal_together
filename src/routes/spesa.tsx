import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Eraser } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import {
  addSpesa,
  clearChecked,
  deleteSpesa,
  listSpesa,
  toggleSpesa,
  REPARTI,
  type SpesaItem,
} from "@/lib/spesa.functions";
import { listPrezzi, type PrezzoProdotto } from "@/lib/prezzi.functions";

export const Route = createFileRoute("/spesa")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lista spesa · Il Quaderno" },
      {
        name: "description",
        content:
          "Lista della spesa condivisa di Giada e Francesco, organizzata per reparto.",
      },
    ],
  }),
  component: SpesaPage,
});

function SpesaPage() {
  const qc = useQueryClient();
  const load = useServerFn(listSpesa);
  const add = useServerFn(addSpesa);
  const toggle = useServerFn(toggleSpesa);
  const del = useServerFn(deleteSpesa);
  const clear = useServerFn(clearChecked);

  const { data } = useQuery({ queryKey: ["spesa"], queryFn: () => load() });
  const loadPrezzi = useServerFn(listPrezzi);
  const { data: prezzi } = useQuery({
    queryKey: ["prezzi"],
    queryFn: () => loadPrezzi(),
  });

  const prezziIndex = useMemo(() => {
    const map = new Map<string, PrezzoProdotto>();
    (prezzi ?? []).forEach((p) => {
      const key = `${p.nome_prodotto.toLowerCase().trim()}|${p.supermercato}`;
      const existing = map.get(key);
      if (!existing || p.data_rilevazione > existing.data_rilevazione) {
        map.set(key, p);
      }
    });
    return map;
  }, [prezzi]);

  function prezziPerNome(nome: string): PrezzoProdotto[] {
    const n = nome.toLowerCase().trim();
    const out: PrezzoProdotto[] = [];
    prezziIndex.forEach((p, key) => {
      if (key.startsWith(`${n}|`)) out.push(p);
    });
    return out.sort((a, b) => a.prezzo - b.prezzo);
  }

  const [nome, setNome] = useState("");
  const [reparto, setReparto] = useState<(typeof REPARTI)[number]>("Frutta e verdura");
  const [quantita, setQuantita] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["spesa"] });

  const addM = useMutation({
    mutationFn: () => add({ data: { nome, reparto, quantita } }),
    onSuccess: () => {
      setNome("");
      setQuantita("");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message ?? "Errore"),
  });

  const toggleM = useMutation({
    mutationFn: (v: { id: string; checked: boolean }) =>
      toggle({ data: v }),
    onSuccess: invalidate,
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: invalidate,
  });

  const clearM = useMutation({
    mutationFn: () => clear(),
    onSuccess: () => {
      invalidate();
      toast.success("Rimossi gli spuntati");
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, SpesaItem[]>();
    (data ?? []).forEach((item) => {
      const key = item.reparto || "Altro";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const totale = data?.length ?? 0;
  const spuntati = (data ?? []).filter((x) => x.checked).length;

  return (
    <div className="min-h-[100dvh] bg-background pb-40 text-foreground">
      <AppHeader
        title="Lista della spesa"
        subtitle={`${spuntati}/${totale} spuntati`}
        right={
          spuntati > 0 ? (
            <button
              onClick={() => clearM.mutate()}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-[11px] uppercase tracking-wider text-foreground/70 hover:bg-muted/40"
            >
              <Eraser className="h-3 w-3" />
              Pulisci
            </button>
          ) : null
        }
      />

      <div className="mx-auto max-w-xl px-4 pt-4">
        {grouped.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            La lista è vuota. Aggiungi il primo prodotto qui sotto.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map(([rep, items]) => (
              <section key={rep} className="card-paper overflow-hidden">
                <header className="border-b border-black/10 px-4 py-2 font-serif text-sm font-medium uppercase tracking-wider text-paper-foreground/70">
                  {rep}
                </header>
                <ul>
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 border-b border-black/5 px-4 py-2.5 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) =>
                          toggleM.mutate({ id: item.id, checked: e.target.checked })
                        }
                        className="h-5 w-5 shrink-0 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm text-paper-foreground ${
                            item.checked ? "line-through opacity-50" : ""
                          }`}
                        >
                          {item.nome}
                        </p>
                        {item.quantita ? (
                          <p className="tabular text-[11px] text-paper-foreground/60">
                            {item.quantita}
                          </p>
                        ) : null}
                        {(() => {
                          const rif = prezziPerNome(item.nome);
                          if (rif.length === 0) return null;
                          return (
                            <p className="tabular mt-0.5 flex flex-wrap gap-x-2 gap-y-0 text-[11px] text-primary/80">
                              {rif.slice(0, 3).map((p) => (
                                <span key={p.id}>
                                  {p.supermercato} {p.prezzo.toFixed(2)}
                                  {p.unita.replace("€", "")}
                                </span>
                              ))}
                            </p>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => delM.mutate(item.id)}
                        className="rounded-md p-1 text-paper-foreground/40 hover:text-destructive"
                        aria-label="Rimuovi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome.trim() || addM.isPending) return;
          addM.mutate();
        }}
        className="fixed bottom-16 left-0 right-0 z-30 border-t border-border/60 bg-background/95 px-3 py-3 backdrop-blur"
      >
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Cosa serve?"
              className="flex-1 rounded-md border border-border/60 bg-paper px-3 py-2 text-sm text-paper-foreground placeholder:text-paper-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={quantita}
              onChange={(e) => setQuantita(e.target.value)}
              placeholder="q."
              className="tabular w-16 rounded-md border border-border/60 bg-paper px-2 py-2 text-center text-sm text-paper-foreground placeholder:text-paper-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              type="submit"
              size="icon"
              disabled={addM.isPending || !nome.trim()}
              className="h-10 w-10 shrink-0"
              aria-label="Aggiungi"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto px-3">
            {REPARTI.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReparto(r)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium ${
                  reparto === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 text-foreground/70 hover:bg-muted/40"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </form>
      <BottomNav />
    </div>
  );
}