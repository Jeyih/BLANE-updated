// Display text only: persist the existing allergy keys for all constraint checks.
// References: https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies
// https://www.cdc.gov/alpha-gal-syndrome/data-research/products-containing-alpha-gal/index.html
// https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/definition-facts
// https://pmc.ncbi.nlm.nih.gov/articles/PMC3594363/
// https://www.chop.edu/conditions-diseases/milk-allergy-diet-children
const COPY = {
  peanut_allergy: ['Peanuts', 'Peanuts and foods made with peanuts.'],
  tree_nut_allergy: ['Tree nuts', 'Such as cashews, almonds and walnuts.'],
  milk_allergy: ['Milk', 'Allergy to milk proteins, not lactose intolerance.'],
  egg_allergy: ['Eggs', 'Eggs and foods made with eggs.'],
  fish_allergy: ['Fish', 'Fish and foods made with fish.'],
  shellfish_allergy: ['Shellfish', 'Such as shrimp, crab and clams.'],
  wheat_allergy: ['Wheat', 'Wheat and foods made with wheat.'],
  soy_allergy: ['Soybeans (soy)', 'Soybeans and soy-based foods, such as tofu.'],
  sesame_allergy: ['Sesame', 'Sesame seeds and foods made with sesame.'],
  alpha_gal_syndrome: ['Mammal-meat allergy (alpha-gal)', 'Beef, pork and other mammal products may trigger reactions.'],
  chicken_meat_allergy_primary: ['Chicken meat', 'A diagnosed allergy to chicken meat.'],
  pork_cat_syndrome: ['Pork allergy linked to cats', 'Pork-cat syndrome; select only if diagnosed.'],
  beef_allergy_milk_cross_reactivity: ['Beef allergy linked to milk', 'A diagnosed allergy involving related proteins in beef and milk.'],
};

export const ALLERGY_GUIDANCE = 'Select all diagnosed food allergies. Skip if none. Check ingredient labels before eating.';

export function allergyCopy(option) {
  const copy = COPY[option.key];
  return { label: copy?.[0] || option.label || option.key, description: copy?.[1] || '' };
}
