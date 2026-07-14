
CREATE TABLE public.prezzi_prodotti (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_prodotto text NOT NULL,
  supermercato text NOT NULL DEFAULT 'altro',
  prezzo numeric NOT NULL,
  unita text NOT NULL DEFAULT '€/pezzo',
  data_rilevazione date NOT NULL DEFAULT CURRENT_DATE,
  fonte text NOT NULL DEFAULT 'manuale',
  foto_scontrino text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prezzi_prodotti TO anon, authenticated;
GRANT ALL ON public.prezzi_prodotti TO service_role;
ALTER TABLE public.prezzi_prodotti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shared access prezzi" ON public.prezzi_prodotti FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_prezzi_prodotti_updated_at BEFORE UPDATE ON public.prezzi_prodotti FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_prezzi_nome_super ON public.prezzi_prodotti (lower(nome_prodotto), supermercato, data_rilevazione DESC);

CREATE TABLE public.ricette_da_provare (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titolo text NOT NULL,
  link_video text,
  note text NOT NULL DEFAULT '',
  stato text NOT NULL DEFAULT 'da provare',
  data_aggiunta timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ricette_da_provare TO anon, authenticated;
GRANT ALL ON public.ricette_da_provare TO service_role;
ALTER TABLE public.ricette_da_provare ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shared access da_provare" ON public.ricette_da_provare FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_ricette_da_provare_updated_at BEFORE UPDATE ON public.ricette_da_provare FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
