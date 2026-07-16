
-- 1) cartelle table
CREATE TABLE public.cartelle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartelle TO anon, authenticated;
GRANT ALL ON public.cartelle TO service_role;

ALTER TABLE public.cartelle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared access cartelle" ON public.cartelle
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2) additive columns on ricette
ALTER TABLE public.ricette
  ADD COLUMN cartella_id uuid REFERENCES public.cartelle(id) ON DELETE SET NULL,
  ADD COLUMN tag text[] NOT NULL DEFAULT '{}',
  ADD COLUMN immagine_url text;

-- 3) seed cartelle from existing distinct categoria (non-null, non-empty)
WITH cats AS (
  SELECT DISTINCT trim(categoria) AS nome
  FROM public.ricette
  WHERE categoria IS NOT NULL AND trim(categoria) <> ''
),
ordered AS (
  SELECT nome, row_number() OVER (ORDER BY nome) AS ord FROM cats
)
INSERT INTO public.cartelle (nome, ordine)
SELECT nome, ord FROM ordered
ON CONFLICT (nome) DO NOTHING;

-- 4) link ricette to cartelle
UPDATE public.ricette r
SET cartella_id = c.id
FROM public.cartelle c
WHERE c.nome = trim(r.categoria)
  AND r.categoria IS NOT NULL AND trim(r.categoria) <> '';
