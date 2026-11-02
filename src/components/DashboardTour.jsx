import React from 'react';
import GuidedTour from './GuidedTour';
const TOUR_STEPS = [
  {
    target: '[data-dashboard-tour="overview"]',
    title: 'Welcome to your dashboard',
    description:
      'Your dashboard brings your nutrition plan and health insights together in one place.',
  },
  {
    target: '[data-dashboard-tour="meal-plan"]',
    title: 'Your meals for today',
    interactionTargets: ['[data-dashboard-tour="meal-plan"] .meal-tab-btn'],
    description:
      'Try switching between meal times to review recipes and nutrition. The bar tracks calories and protein against your daily goal. After the tour, open Meal Plan to make changes.',
  },
  {
    target: '[data-dashboard-tour="body-stats"]',
    title: 'Your BMI and body stats',
    description:
      'See your BMI category and range, height, weight, BMI index, and estimated healthy weight range from your profile.',
  },
  {
    target: '[data-dashboard-tour="recommendations"]',
    title: 'Recommendations picked for you',
    description:
      'Review recipe matches with their match scores, nutrition, cost, and reasons they fit your goal and dietary profile. After the tour, select a recipe or view all recipes to explore.',
  },
  {
    target: '[data-dashboard-tour="feedback"]',
    title: 'Log your daily health',
    description:
      'After the tour, record weight, sleep, water, and calories burned here. BLANE uses your entries to refresh nutrition targets, show alerts, and track your recent history.',
  },
  {
    target: '[data-dashboard-tour="drift"]',
    title: 'Follow your health trends',
    description:
      'Health Drift Detection shows your recorded measurements after the first saved entry. Trends develop as you add more entries. This summary is not a clinical health assessment.',
  },
];
function DashboardTour({ isOpen, onClose }) {
  return React.createElement(GuidedTour, {
    isOpen,
    onClose,
    title: 'Dashboard tour',
    steps: TOUR_STEPS,
  });
}
export { DashboardTour as default };
