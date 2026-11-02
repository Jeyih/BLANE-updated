-- Quantity evidence only: administrators cannot edit automatic source prices through this policy.
ALTER TABLE public.price_reference_data DROP CONSTRAINT IF EXISTS recipe_cost_basis_shape;
ALTER TABLE public.price_reference_data ADD CONSTRAINT recipe_cost_basis_shape CHECK (
  catalogue <> 'recipe_cost_basis' OR (
    jsonb_typeof(data) = 'object'
    AND coalesce(jsonb_typeof(data->'name') = 'string' AND length(data->>'name') > 0, false)
    AND coalesce(jsonb_typeof(data->'grams') = 'number', false)
    AND CASE WHEN jsonb_typeof(data->'grams') = 'number' THEN (data->>'grams')::numeric > 0 ELSE false END
    AND coalesce(jsonb_typeof(data->'amount') = 'number', false)
    AND CASE WHEN jsonb_typeof(data->'amount') = 'number' THEN (data->>'amount')::numeric > 0 ELSE false END
    AND coalesce(data->>'unit' IN ('kg', 'l', 'pc'), false)
    AND coalesce(data->>'sourceUrl' ~ '^https://[^[:space:]]+$', false)
    AND coalesce(length(trim(data->>'evidence')) >= 20, false)
    AND coalesce(data->>'measuredAt' ~ '^\d{4}-\d{2}-\d{2}$', false)
    AND coalesce(data->'confirmed' = 'true'::jsonb, false)
  )
);

GRANT INSERT, UPDATE, DELETE ON public.price_reference_data TO authenticated;
DROP POLICY IF EXISTS recipe_cost_evidence_insert ON public.price_reference_data;
CREATE POLICY recipe_cost_evidence_insert ON public.price_reference_data FOR INSERT TO authenticated
  WITH CHECK (catalogue = 'recipe_cost_basis' AND public.blane_is_admin());
DROP POLICY IF EXISTS recipe_cost_evidence_update ON public.price_reference_data;
CREATE POLICY recipe_cost_evidence_update ON public.price_reference_data FOR UPDATE TO authenticated
  USING (catalogue = 'recipe_cost_basis' AND public.blane_is_admin())
  WITH CHECK (catalogue = 'recipe_cost_basis' AND public.blane_is_admin());
DROP POLICY IF EXISTS recipe_cost_evidence_delete ON public.price_reference_data;
CREATE POLICY recipe_cost_evidence_delete ON public.price_reference_data FOR DELETE TO authenticated
  USING (catalogue = 'recipe_cost_basis' AND public.blane_is_admin());
