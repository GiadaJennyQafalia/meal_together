CREATE TABLE public.spese_scontrino (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_acquisto date NOT NULL DEFAULT CURRENT_DATE,
  supermercato text NOT NULL DEFAULT 'altro',
  totale numeric,
  n_prodotti integer NOT NULL DEFAULT 0,
  foto_scontrino text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spese_scontrino TO anon, authenticated;
GRANT ALL ON public.spese_scontrino TO service_role;

ALTER TABLE public.spese_scontrino ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared access spese_scontrino" ON public.spese_scontrino
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_spese_scontrino_data ON public.spese_scontrino (data_acquisto DESC);