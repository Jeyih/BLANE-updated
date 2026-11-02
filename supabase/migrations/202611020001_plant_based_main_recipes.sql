-- Three plant-based recipe options. FNRI ingredient-input estimates; not clinical approval.
-- Raw input quantities avoid assuming that cooked weight equals purchased raw weight.
-- Idempotent: matching names are left unchanged. No existing recipes are edited.
BEGIN;
DO $seed$
DECLARE r jsonb; recipe_id_new text; missing integer;
BEGIN
  FOR r IN SELECT value FROM jsonb_array_elements($recipes$[{"id":"rcp-plant-savory-oatmeal-with-tomato","name":"Savory Oatmeal with Tomato","type":"Breakfast","cookTime":15,"ingredients":[{"fct_id":"0141","name":"Oats, quick-cooking","grams":60,"quantity":"60 g before cooking"},{"fct_id":"0523","name":"Tomato","grams":100,"quantity":"100 g before cooking"},{"fct_id":"0409","name":"Onion, Bombay bulb","grams":20,"quantity":"20 g before cooking"},{"fct_id":"0355","name":"Garlic bulb","grams":3,"quantity":"3 g before cooking"},{"fct_id":"1226","name":"Oil, coconut","grams":5,"quantity":"5 g before cooking"}],"steps":[{"title":"Prepare ingredients","desc":"Weigh 60 g dry oats, 100 g tomato, 20 g onion, 3 g garlic and 5 g coconut oil. Use plain water as the cooking liquid."},{"title":"Cook aromatics","desc":"Warm the oil in a small pan. Soften the chopped onion, garlic and tomato."},{"title":"Cook oats","desc":"Add the dry oats and about 250 ml plain water. Simmer until the oats soften, adding water as needed. Serve the entire prepared batch as one serving."}]},{"id":"rcp-plant-cabbage-and-carrot-rice-bowl","name":"Cabbage and Carrot Rice Bowl","type":"Lunch","cookTime":30,"ingredients":[{"fct_id":"0017","name":"Rice, well-milled","grams":75,"quantity":"75 g before cooking"},{"fct_id":"0308","name":"Cabbage, green","grams":150,"quantity":"150 g before cooking"},{"fct_id":"0312","name":"Carrot","grams":50,"quantity":"50 g before cooking"},{"fct_id":"0355","name":"Garlic bulb","grams":5,"quantity":"5 g before cooking"},{"fct_id":"1226","name":"Oil, coconut","grams":7,"quantity":"7 g before cooking"}],"steps":[{"title":"Measure raw inputs","desc":"Weigh 75 g dry rice, 150 g raw cabbage, 50 g raw carrot, 5 g garlic and 7 g coconut oil. Quantities refer to ingredients before cooking."},{"title":"Cook rice","desc":"Rinse the measured dry rice and cook with plain water until tender."},{"title":"Cook vegetables","desc":"Warm the oil, soften the garlic, then add chopped cabbage and carrot. Add a little plain water and cook until tender. Serve with the entire cooked rice batch as one serving."}]},{"id":"rcp-plant-tomato-vegetable-rice-soup","name":"Tomato Vegetable Rice Soup","type":"Dinner","cookTime":30,"ingredients":[{"fct_id":"0017","name":"Rice, well-milled","grams":60,"quantity":"60 g before cooking"},{"fct_id":"0523","name":"Tomato","grams":120,"quantity":"120 g before cooking"},{"fct_id":"0312","name":"Carrot","grams":80,"quantity":"80 g before cooking"},{"fct_id":"0308","name":"Cabbage, green","grams":100,"quantity":"100 g before cooking"},{"fct_id":"0409","name":"Onion, Bombay bulb","grams":30,"quantity":"30 g before cooking"},{"fct_id":"0355","name":"Garlic bulb","grams":3,"quantity":"3 g before cooking"},{"fct_id":"1226","name":"Oil, coconut","grams":5,"quantity":"5 g before cooking"}],"steps":[{"title":"Measure raw inputs","desc":"Weigh 60 g dry rice, 120 g tomato, 80 g raw carrot, 100 g raw cabbage, 30 g onion, 3 g garlic and 5 g coconut oil."},{"title":"Start soup","desc":"Warm the oil and soften the onion, garlic and tomato. Add the dry rice and about 400 ml plain water."},{"title":"Finish soup","desc":"Simmer until the rice and carrot are tender, adding water as needed. Add the cabbage and cook through. Serve the entire prepared batch as one serving."}]}]$recipes$::jsonb) LOOP
    IF EXISTS (SELECT 1 FROM public.recipes WHERE name = r->>'name' OR id = r->>'id') THEN CONTINUE; END IF;
    SELECT count(*) INTO missing FROM jsonb_array_elements(r->'ingredients') ingredient
      WHERE NOT EXISTS(SELECT 1 FROM public.fnri_food_composition f WHERE f.fct_id = ingredient->>'fct_id');
    IF missing > 0 THEN RAISE EXCEPTION 'Required FNRI raw ingredient missing'; END IF;
    INSERT INTO public.recipes(id,name,type,difficulty,cook_time_min,servings,cost,kcal,protein_g,carbs_g,fats_g,diet_tags,goal_tags)
      SELECT r->>'id',r->>'name',r->>'type','easy',(r->>'cookTime')::integer,1,0,
       round(sum(f.energy_kcal * (ingredient->>'grams')::numeric / 100)),
       round(sum(f.protein_g * (ingredient->>'grams')::numeric / 100),1),
       round(sum(f.available_carbohydrate_g * (ingredient->>'grams')::numeric / 100),1),
       round(sum(f.total_fat_g * (ingredient->>'grams')::numeric / 100),1),
       ARRAY['vegan','vegetarian','dairy_free']::text[], ARRAY['improve_health','maintain']::text[]
      FROM jsonb_array_elements(r->'ingredients') ingredient JOIN public.fnri_food_composition f ON f.fct_id=ingredient->>'fct_id'
      RETURNING id INTO recipe_id_new;
    INSERT INTO public.recipe_ingredients(recipe_id,fct_id,name,grams,quantity,status,sort_order)
      SELECT recipe_id_new,ingredient->>'fct_id',ingredient->>'name',(ingredient->>'grams')::numeric,ingredient->>'quantity','avail',ordinality::integer-1
      FROM jsonb_array_elements(r->'ingredients') WITH ORDINALITY AS t(ingredient,ordinality);
    INSERT INTO public.recipe_steps(recipe_id,title,description,step_order)
      SELECT recipe_id_new,step->>'title',step->>'desc',ordinality::integer-1
      FROM jsonb_array_elements(r->'steps') WITH ORDINALITY AS t(step,ordinality);
    INSERT INTO public.recipe_steps(recipe_id,title,description,step_order) VALUES(recipe_id_new,'Nutrition and costing basis','Research recipe awaiting nutritionist review. Nutrition is estimated from the listed FNRI raw ingredient inputs, not measured cooked output. Price excludes cooking water, fuel, labour and any unlisted additions. Divide the prepared batch only if you also divide the displayed portion.',99);
  END LOOP;
END $seed$;
COMMIT;
SELECT name,type,kcal FROM public.recipes WHERE name IN ('Savory Oatmeal with Tomato','Cabbage and Carrot Rice Bowl','Tomato Vegetable Rice Soup') ORDER BY type;
