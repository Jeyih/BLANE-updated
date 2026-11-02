// Transcribed facts checked against the rendered source pages. Instructions are summarized.
// Published serving values belong to the original formulation, not BLANE adaptations.
export const PGH_RECIPE_SOURCE = {
  title: 'Low Protein Recipe Book',
  publisher: 'Newborn Screening Reference Center and PGH Dietary Department, UP Manila',
  url: 'https://newbornscreening.ph/wp-content/uploads/2024/06/Recipe-Book-Jul-20-22.pdf',
};

export const PGH_RECIPE_REFERENCES = [
  {
    id: 'pgh-squash-porridge', name: 'Rice Porridge with Squash', category: 'Porridge',
    printedPage: 4, pdfPage: 11, yield: '5 1/2 cups', serving: '1/2 cup (112 g)',
    nutrients: { kcal: 47, protein: 0.74, fat: 1.95, carbs: 6.75 },
    ingredients: [['Glutinous rice', '61 g'], ['Cooking oil', '2 tbsp'], ['Garlic', '10 g'], ['Onion', '29 g'], ['Ginger', '4 g'], ['Squash', '189 g'], ['Rock salt', '1 tbsp'], ['Water', '6 cups']],
    preparation: ['Soak the rice.', 'Cook the garlic, onion and ginger in the oil.', 'Add water and cook the squash until soft.', 'Add the soaked rice. Cook gently until the rice is done.', 'Add the salt listed in the source recipe.'],
    checks: 'The oil type is unspecified. Review the rice portion, salt amount and ingredient labels for the intended diet.',
  },
  {
    id: 'pgh-chayote-carrot', name: 'Sauteed Chayote and Carrot', category: 'Vegetable side',
    printedPage: 7, pdfPage: 14, yield: '2 cups', serving: '1/4 cup (41 g)',
    nutrients: { kcal: 33, protein: 0.43, fat: 2.07, carbs: 3.20 },
    ingredients: [['Cooking oil', '2 tbsp'], ['Garlic', '9 g'], ['Onion', '61 g'], ['Tomato', '71 g'], ['Carrot', '42 g'], ['Chayote', '232 g'], ['Rock salt', '1 tsp'], ['Water', '1/2 cup']],
    preparation: ['Cook the garlic and onion in the oil.', 'Add the tomato and water.', 'Add the carrot and cook until soft.', 'Add the listed salt and chayote. Cook until tender.'],
    checks: 'The oil type is unspecified. Aromatics and tomato may conflict with saved restrictions; the small serving is a side dish.',
  },
  {
    id: 'pgh-potato-carrot-soup', name: 'Potato and Carrot Soup', category: 'Soup',
    printedPage: 32, pdfPage: 39, yield: '4 cups', serving: '1/3 cup (64 g)',
    nutrients: { kcal: 42, protein: 0.88, fat: 1.44, carbs: 6.24 },
    ingredients: [['Potato', '457 g'], ['Margarine', '20 g'], ['Carrot', '30 g'], ['Water', '3 cups'], ['Rock salt', '1 tsp']],
    preparation: ['Boil the potatoes until soft.', 'Mash and strain the potatoes. Keep the cooking water.', 'Mix the potatoes back into the cooking water.', 'Add the margarine and listed salt.', 'Add the grated carrot. Cook gently for a short time.'],
    checks: 'Margarine composition and allergen labels require checking. A mashed or strained soup has not automatically passed a prescribed texture assessment.',
  },
  {
    id: 'pgh-potato-squash-soup', name: 'Potato and Squash Soup', category: 'Soup',
    printedPage: 33, pdfPage: 40, yield: '3 1/2 cups', serving: '1/3 cup (71 g)',
    nutrients: { kcal: 41, protein: 0.75, fat: 1.83, carbs: 5.37 },
    ingredients: [['Potato', '219 g'], ['Squash', '161 g'], ['Water', '3 cups'], ['Margarine', '19 g'], ['Rock salt', '1 tbsp']],
    preparation: ['Boil the potato and squash until soft.', 'Mash and strain the vegetables. Keep the cooking water.', 'Mix the vegetables back into the cooking water.', 'Add the margarine and listed salt.', 'Cook gently for a short time.'],
    checks: 'Margarine composition, salt quantity and individual mineral limits require review. No texture level is assigned.',
  },
];
