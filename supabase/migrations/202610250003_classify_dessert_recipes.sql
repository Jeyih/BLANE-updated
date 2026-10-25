-- Keep dessert classification in recipe records without changing the recipe type constraint.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_dessert boolean NOT NULL DEFAULT false;

UPDATE public.recipes AS recipe
SET is_dessert = true
WHERE recipe.is_dessert IS DISTINCT FROM true
  AND (
    recipe.type = 'Dessert'
    OR
    recipe.name ~* '(cassava cake|bibingka|polvoron|banana cue|turon|camote cue|sweet potato.*sugar|banana.*sugar|puto|champorado|suman|ginataang monggo|biko|leche flan|halo.?halo)'
    OR EXISTS (
      SELECT 1
      FROM public.recipe_ingredients AS ingredient
      WHERE ingredient.recipe_id = recipe.id
        AND ingredient.name ~* '(rice cake|cookies, polvoron|banana, saba, w/ sugar|sweet potato, w/ sugar)'
    )
  );
