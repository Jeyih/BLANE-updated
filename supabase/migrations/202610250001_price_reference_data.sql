-- Store sourced price snapshots and their reviewed matching/source catalogues in Supabase.
CREATE TABLE IF NOT EXISTS public.price_reference_data (
  catalogue text NOT NULL,
  entry_key text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_reference_data_pkey PRIMARY KEY (catalogue, entry_key)
);

ALTER TABLE public.price_reference_data ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.price_reference_data TO anon, authenticated;
GRANT ALL ON public.price_reference_data TO service_role;

DROP POLICY IF EXISTS price_reference_data_read ON public.price_reference_data;
CREATE POLICY price_reference_data_read
  ON public.price_reference_data
  FOR SELECT TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.price_reference_data IS
  'Editable price snapshots, source matching rules, and food reference records used by BLANE.';

CREATE OR REPLACE FUNCTION public.replace_price_reference_data(
  p_catalogues text[],
  p_entries jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  inserted_count integer;
  expected_count integer;
  entry_count integer;
BEGIN
  IF p_catalogues IS NULL
    OR cardinality(p_catalogues) = 0
    OR NOT (p_catalogues <@ ARRAY['da_price', 'retail_price', 'da_report']::text[])
  THEN
    RAISE EXCEPTION 'Invalid price reference replacement request';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'Price reference entries must be a JSON array';
  END IF;

  entry_count := jsonb_array_length(p_entries);
  IF entry_count = 0 THEN
    RAISE EXCEPTION 'Price reference replacement cannot be empty';
  END IF;

  SELECT count(*) INTO expected_count
  FROM jsonb_to_recordset(p_entries) AS entry(catalogue text, entry_key text, data jsonb)
  WHERE entry.catalogue = ANY (p_catalogues);

  IF expected_count <> entry_count THEN
    RAISE EXCEPTION 'Price reference entries do not match the requested catalogues';
  END IF;

  DELETE FROM public.price_reference_data
  WHERE catalogue = ANY (p_catalogues);

  INSERT INTO public.price_reference_data (catalogue, entry_key, data)
  SELECT entry.catalogue, entry.entry_key, entry.data
  FROM jsonb_to_recordset(p_entries) AS entry(catalogue text, entry_key text, data jsonb)
  WHERE entry.catalogue = ANY (p_catalogues);

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> expected_count THEN
    RAISE EXCEPTION 'Price reference replacement was incomplete';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_price_reference_data(text[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_price_reference_data(text[], jsonb) TO service_role;
