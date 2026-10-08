import GuidedTour from './GuidedTour';

const TOUR_STEPS = [
  {
    target: '[data-mealplan-tour="header"]',
    title: 'Your weekly meal plan',
    description: 'Export your week as a text file, or regenerate the meal plan for the week when you want a fresh set of meals.',
  },
  {
    target: '[data-mealplan-tour="week"]',
    title: 'Choose a week and day',
    description: 'Move between weeks with the arrows, then select a day to view or edit its meals. Dots indicate planned meals; a different dot marks days with completed meals.',
  },
  {
    target: '[data-mealplan-tour="summary"]',
    title: 'Track daily nutrition and cost',
    description: 'See the selected day’s calories versus your goal, protein, estimated cost, and calorie progress.',
  },
  {
    target: '[data-mealplan-tour="meal-slots"]',
    title: 'Manage each meal',
    description: 'When meals are planned, review their macros, calories, cost, seasonal availability, and profile constraint warnings. Expand ingredients, swap a recipe, mark it finished, add ingredients to groceries, optimize portions, or ask why a recipe was chosen.',
  },
  {
    target: '[data-mealplan-tour="add-slot"]',
    title: 'Add a meal or snack',
    description: 'Add breakfast, brunch, lunch, snack, dinner, or a custom meal slot, then assign a recipe.',
  },
  {
    target: '[data-mealplan-tour="price-optimizer"]',
    title: 'Plan around your food budget',
    description: 'Set a daily budget and get affordable meal suggestions. Sort meals by cost or value, filter by budget, and expand a meal to inspect ingredient costs and savings tips.',
  },
  {
    target: '[data-mealplan-tour="grocery-list"]',
    title: 'Build your grocery list',
    description: 'Add ingredients from an individual meal or all meals for the selected day. Check items off while shopping, remove items, or clear the list.',
  },
];

export default function MealPlanTour({ isOpen, onClose }) {
  return <GuidedTour isOpen={isOpen} onClose={onClose} title="Meal Plan tour" steps={TOUR_STEPS} />;
}
