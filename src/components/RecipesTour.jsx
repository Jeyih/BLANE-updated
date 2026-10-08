import GuidedTour from './GuidedTour';

const TOUR_STEPS = [
  {
    target: '[data-recipes-tour="header"]',
    title: 'Welcome to your recipe collection',
    description: 'Browse Filipino meals matched to your nutrition goals. The season badge shows current local ingredient seasonality, and the count reflects your current results.',
  },
  {
    target: '[data-recipes-tour="constraints"]',
    title: 'Check your dietary constraints',
    description: 'Your active allergies, medical needs, and dietary preferences are shown here. Recipe cards flag ingredients that may conflict with those constraints.',
  },
  {
    target: '[data-recipes-tour="search"]',
    title: 'Search recipes your way',
    description: 'Search by recipe name, meal type, or ingredient to quickly narrow down the collection.',
  },
  {
    target: '[data-recipes-tour="filters"]',
    title: 'Filter by meal and diet',
    description: 'Choose a meal type or dietary tag. Select the same filter again to clear it; search and filters can be combined.',
  },
  {
    target: '[data-recipes-tour="results"]',
    title: 'Compare recipe cards',
    description: 'Cards show cooking time, servings, macros, calories, estimated cost, seasonality, and constraint warnings. Select a card to see full nutrition details, ingredients, seasonal alternatives, cooking steps, and add it to your Meal Plan.',
  },
];

export default function RecipesTour({ isOpen, onClose }) {
  return <GuidedTour isOpen={isOpen} onClose={onClose} title="Recipes tour" steps={TOUR_STEPS} />;
}
