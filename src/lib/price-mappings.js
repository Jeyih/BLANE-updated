const RAW_DA_MAPPINGS = {
  'Egg, chicken, whole, boiled': 'Egg',
  'Carrot, boiled': 'Carrot',
  'Eggplant, boiled': 'Eggplant',
  'Potato, boiled': 'Potato',
  'Squash fruit, boiled': 'Squash',
  'String/Yard long bean pod, green, boiled': 'Sitaw',
  'Mung bean seed, green, dried, boiled': 'Mungbean',
  'Milkfish, fried': 'Bangus',
  'Rice, well-milled, boiled': 'White rice',
  'Rice, well-milled, fried': 'White rice',
  'Banana, saba, w/ sugar, fried': 'Banana saba',
  'Banana, saba, w/ sugar, wrapped, fried': 'Banana saba',
  'Sweet potato, w/ sugar, fried': 'Sweet potato',
};
const DA_NAME_MAPPINGS = { 'Garlic bulb': 'Local garlic', 'Onion, Bombay bulb': 'Red onion' };
const COMPARABLE_PRICE_MAPPINGS = {
  'Pork, suckling, leg': {
    name: 'Pork shoulder',
    note: 'Regular pork shoulder (kasim) benchmark; not a verified suckling-pig leg price.',
  },
  'Duck liver': {
    name: 'Chicken liver',
    note: 'Ordinary chicken-liver benchmark; not a verified duck-liver price.',
  },
  'Lima bean pod, boiled': {
    name: 'Baguio beans',
    note: 'Fresh green-bean pod benchmark; not a verified lima-bean pod price. Cooking yield is excluded.',
  },
  'Quail meat': {
    name: 'Whole chicken',
    note: 'Local poultry benchmark using whole chicken; not a verified quail price. Species and edible yields differ.',
  },
  'Duck breast': {
    name: 'Whole duck',
    note: 'Whole-duck benchmark including bone and other cuts; not a verified boneless breast price. Edible yield is excluded.',
  },
};
const PARTIAL_RAW_FOODS = new Set([
  'Rice, well-milled, fried',
  'Milkfish, fried',
  'Banana, saba, w/ sugar, fried',
  'Banana, saba, w/ sugar, wrapped, fried',
  'Sweet potato, w/ sugar, fried',
]);
export { COMPARABLE_PRICE_MAPPINGS, DA_NAME_MAPPINGS, PARTIAL_RAW_FOODS, RAW_DA_MAPPINGS };
