
CREATE TABLE public.dispensa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_ingrediente TEXT NOT NULL,
  quantita NUMERIC,
  unita TEXT,
  peso NUMERIC,
  categoria TEXT NOT NULL DEFAULT 'altro',
  scadenza DATE,
  fonte TEXT NOT NULL DEFAULT 'manuale',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispensa TO anon, authenticated;
GRANT ALL ON public.dispensa TO service_role;

ALTER TABLE public.dispensa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispensa condivisa - lettura" ON public.dispensa FOR SELECT USING (true);
CREATE POLICY "Dispensa condivisa - inserimento" ON public.dispensa FOR INSERT WITH CHECK (true);
CREATE POLICY "Dispensa condivisa - modifica" ON public.dispensa FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Dispensa condivisa - eliminazione" ON public.dispensa FOR DELETE USING (true);

CREATE TRIGGER update_dispensa_updated_at
  BEFORE UPDATE ON public.dispensa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX dispensa_scadenza_idx ON public.dispensa (scadenza);
CREATE INDEX dispensa_nome_lower_idx ON public.dispensa (lower(nome_ingrediente));
