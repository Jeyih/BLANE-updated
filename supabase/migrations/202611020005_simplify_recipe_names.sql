-- Remove the cuisine prefix from only the nine newly added recipe names.
BEGIN;
UPDATE public.recipes SET name=replace(name,'Filipino ','') WHERE id IN ('rcp-plant-savory-oatmeal-with-tomato','rcp-plant-cabbage-and-carrot-rice-bowl','rcp-plant-tomato-vegetable-rice-soup','rcp-plant-carrot-rice-porridge','rcp-plant-steamed-cabbage-and-carrot-rice','rcp-plant-thick-carrot-and-cabbage-rice-soup','rcp-plant-carrot-oatmeal','rcp-plant-cabbage-and-carrot-oat-bowl','rcp-plant-thick-vegetable-oat-soup') AND name LIKE '%Filipino %';
COMMIT;
SELECT name,type FROM public.recipes WHERE id IN ('rcp-plant-savory-oatmeal-with-tomato','rcp-plant-cabbage-and-carrot-rice-bowl','rcp-plant-tomato-vegetable-rice-soup','rcp-plant-carrot-rice-porridge','rcp-plant-steamed-cabbage-and-carrot-rice','rcp-plant-thick-carrot-and-cabbage-rice-soup','rcp-plant-carrot-oatmeal','rcp-plant-cabbage-and-carrot-oat-bowl','rcp-plant-thick-vegetable-oat-soup') ORDER BY type,name;
