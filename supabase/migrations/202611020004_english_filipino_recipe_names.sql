-- English names for the nine Filipino-based research recipes.
-- Only display names change; ingredients, nutrition, steps and identifiers are preserved.
BEGIN;
UPDATE public.recipes r SET name=v.name FROM (VALUES
 ('rcp-plant-savory-oatmeal-with-tomato','Filipino Tomato Oat Porridge (Adapted)'),
 ('rcp-plant-cabbage-and-carrot-rice-bowl','Filipino Sauteed Cabbage and Carrots with Rice'),
 ('rcp-plant-tomato-vegetable-rice-soup','Filipino Rice Porridge with Tomato and Vegetables'),
 ('rcp-plant-carrot-rice-porridge','Filipino Rice Porridge with Carrot'),
 ('rcp-plant-steamed-cabbage-and-carrot-rice','Filipino Boiled Cabbage and Carrots with Rice'),
 ('rcp-plant-thick-carrot-and-cabbage-rice-soup','Thick Filipino Vegetable Rice Porridge'),
 ('rcp-plant-carrot-oatmeal','Filipino Carrot Oat Porridge (Adapted)'),
 ('rcp-plant-cabbage-and-carrot-oat-bowl','Filipino Vegetable Oat Porridge (Adapted)'),
 ('rcp-plant-thick-vegetable-oat-soup','Thick Filipino Vegetable Oat Porridge (Adapted)')
) AS v(id,name) WHERE r.id=v.id;
COMMIT;
SELECT name,type FROM public.recipes WHERE id IN ('rcp-plant-savory-oatmeal-with-tomato','rcp-plant-cabbage-and-carrot-rice-bowl','rcp-plant-tomato-vegetable-rice-soup','rcp-plant-carrot-rice-porridge','rcp-plant-steamed-cabbage-and-carrot-rice','rcp-plant-thick-carrot-and-cabbage-rice-soup','rcp-plant-carrot-oatmeal','rcp-plant-cabbage-and-carrot-oat-bowl','rcp-plant-thick-vegetable-oat-soup') ORDER BY type,name;
