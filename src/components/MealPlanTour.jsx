import React from 'react';
import GuidedTour from './GuidedTour';
const TOUR_STEPS = [
  {
    target: '[data-mealplan-tour="header"]',
    title: 'Your weekly meal plan',
    description:
      'After the tour, export your week as a text file, or regenerate the week when you want a fresh set of meals.',
  },
  {
    target: '[data-mealplan-tour="week"]',
    title: 'Choose a week and day',
    interactionTargets: ['[data-mealplan-tour="week"] button'],
    description:
      'Move between weeks with the arrows, then select a day to view or edit its meals. Dots indicate planned meals; a different dot marks days with completed meals.',
  },
  {
    target: '[data-mealplan-tour="summary"]',
    title: 'Track daily nutrition and cost',
    description:
      'See the selected day\u2019s calories versus your goal, protein, estimated cost, and calorie progress.',
  },
  {
    target: '[data-mealplan-tour="meal-slots"]',
    title: 'Manage each meal',
    description:
      'When meals are planned, review their nutrition, cost, and profile warnings. After the tour, expand ingredients, swap recipes, mark meals finished, add groceries, optimize portions, or ask why a recipe was chosen.',
  },
  {
    target: '[data-mealplan-tour="add-slot"]',
    title: 'Add a meal or snack',
    description:
      'After the tour, add breakfast, brunch, lunch, snack, dinner, or a custom meal slot, then assign a recipe.',
  },
  {
    target: '[data-mealplan-tour="price-optimizer"]',
    title: 'Plan around your food budget',
    description:
      'After the tour, set a daily budget, sort or filter meal suggestions, and expand a meal to inspect ingredient costs and savings tips.',
  },
  {
    target: '[data-mealplan-tour="grocery-list"]',
    title: 'Build your grocery list',
    description:
      'After the tour, add ingredients from one meal or all meals for a day. Check items off while shopping, remove items, or clear the list.',
  },
];
function MealPlanTour({ isOpen, onClose }) {
  return React.createElement(GuidedTour, {
    isOpen,
    onClose,
    title: 'Meal Plan tour',
    steps: TOUR_STEPS,
  });
}
export { MealPlanTour as default };
