
CREATE TABLE public.ricette (
  id text PRIMARY KEY,
  titolo text NOT NULL,
  categoria text,
  tipo text,
  kcal integer,
  proteine_g numeric,
  carboidrati_g numeric,
  grassi_g numeric,
  tempo_minuti integer,
  congelabile boolean DEFAULT false,
  voto integer,
  da_rifare boolean DEFAULT false,
  stagionalita text[] DEFAULT '{}',
  ingredienti text[] DEFAULT '{}',
  note text DEFAULT '',
  scaling_francesco text DEFAULT '',
  varianti text[] DEFAULT '{}',
  modifiche text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ricette TO anon, authenticated;
GRANT ALL ON public.ricette TO service_role;
ALTER TABLE public.ricette ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shared access ricette" ON public.ricette FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.lista_spesa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  reparto text NOT NULL DEFAULT 'Altro',
  checked boolean NOT NULL DEFAULT false,
  quantita text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lista_spesa TO anon, authenticated;
GRANT ALL ON public.lista_spesa TO service_role;
ALTER TABLE public.lista_spesa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shared access lista" ON public.lista_spesa FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shared access chat" ON public.chat_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ricette_updated_at BEFORE UPDATE ON public.ricette
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
