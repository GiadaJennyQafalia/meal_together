
CREATE TABLE public.ricetta_ingredienti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ricetta_id TEXT NOT NULL REFERENCES public.ricette(id) ON DELETE CASCADE,
  nome_ingrediente TEXT NOT NULL,
  quantita NUMERIC,
  quantita_max NUMERIC,
  unita TEXT,
  gruppo TEXT,
  note TEXT,
  posizione INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ricetta_ingredienti_ricetta_id_idx ON public.ricetta_ingredienti(ricetta_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ricetta_ingredienti TO anon, authenticated;
GRANT ALL ON public.ricetta_ingredienti TO service_role;

ALTER TABLE public.ricetta_ingredienti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared access ricetta_ingredienti"
  ON public.ricetta_ingredienti
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_ricetta_ingredienti_updated_at
  BEFORE UPDATE ON public.ricetta_ingredienti
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
