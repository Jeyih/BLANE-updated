-- Align only the nine newly added research recipes with Philippine home cooking.
-- Existing identifiers, ingredient weights, nutrient totals and prices remain intact.
BEGIN;
UPDATE public.recipes AS r SET name = v.name FROM (VALUES
 ('rcp-plant-savory-oatmeal-with-tomato','Lugaw-Style Oatmeal with Tomato (Filipino-Inspired)'),
 ('rcp-plant-cabbage-and-carrot-rice-bowl','Ginisang Repolyo at Karot with Rice'),
 ('rcp-plant-tomato-vegetable-rice-soup','Lugaw na May Kamatis at Gulay'),
 ('rcp-plant-carrot-rice-porridge','Lugaw na May Karot'),
 ('rcp-plant-steamed-cabbage-and-carrot-rice','Nilagang Repolyo at Karot with Rice'),
 ('rcp-plant-thick-carrot-and-cabbage-rice-soup','Malapot na Lugaw na May Gulay'),
 ('rcp-plant-carrot-oatmeal','Oatmeal Lugaw na May Karot (Adapted)'),
 ('rcp-plant-cabbage-and-carrot-oat-bowl','Gulay at Oats (Filipino-Style Adaptation)'),
 ('rcp-plant-thick-vegetable-oat-soup','Malapot na Oatmeal Lugaw with Vegetables (Adapted)')
) AS v(id,name) WHERE r.id = v.id;
UPDATE public.recipe_steps SET title='Cook rice and vegetables', description='Rinse the measured dry rice and cook it with plain water until tender. In a separate small pan, simmer the weighed cabbage and carrot in a little plain water until tender, then stir in the measured coconut oil. Serve all of the rice and vegetables as one portion. The listed weights are before cooking.' WHERE recipe_id='rcp-plant-steamed-cabbage-and-carrot-rice' AND step_order=1;
INSERT INTO public.recipe_steps(recipe_id,title,description,step_order)
SELECT r.id,'Philippine cooking basis',CASE WHEN r.id IN ('rcp-plant-savory-oatmeal-with-tomato','rcp-plant-carrot-oatmeal','rcp-plant-cabbage-and-carrot-oat-bowl','rcp-plant-thick-vegetable-oat-soup') THEN 'Filipino-inspired oatmeal adaptation, not a traditional named dish. ' ELSE 'Philippine home-cooking adaptation based on lugaw and vegetable-and-rice meals. ' END || 'Context references: DOST-FNRI Menu Guide Calendar https://www.fnri.dost.gov.ph/images/images/standardtools/MenuGuideCalendar/MGC2021.pdf and DepEd school feeding recipe list https://www.deped.gov.ph/wp-content/uploads/2011/10/DO_s2011_80-1.pdf . These are contextual references, not the exact recipe source or nutritionist approval. Ingredient quantities and nutrition estimates are BLANE research formulations.',100
FROM public.recipes r WHERE r.id IN ('rcp-plant-savory-oatmeal-with-tomato','rcp-plant-cabbage-and-carrot-rice-bowl','rcp-plant-tomato-vegetable-rice-soup','rcp-plant-carrot-rice-porridge','rcp-plant-steamed-cabbage-and-carrot-rice','rcp-plant-thick-carrot-and-cabbage-rice-soup','rcp-plant-carrot-oatmeal','rcp-plant-cabbage-and-carrot-oat-bowl','rcp-plant-thick-vegetable-oat-soup') AND NOT EXISTS(SELECT 1 FROM public.recipe_steps s WHERE s.recipe_id=r.id AND s.step_order=100);
COMMIT;
SELECT name,type FROM public.recipes WHERE id IN ('rcp-plant-savory-oatmeal-with-tomato','rcp-plant-cabbage-and-carrot-rice-bowl','rcp-plant-tomato-vegetable-rice-soup','rcp-plant-carrot-rice-porridge','rcp-plant-steamed-cabbage-and-carrot-rice','rcp-plant-thick-carrot-and-cabbage-rice-soup','rcp-plant-carrot-oatmeal','rcp-plant-cabbage-and-carrot-oat-bowl','rcp-plant-thick-vegetable-oat-soup') ORDER BY type,name;
