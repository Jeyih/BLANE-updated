import GuidedTour from './GuidedTour';

const TOUR_STEPS = [
  {
    target: '[data-dashboard-tour="overview"]',
    title: 'Welcome to your dashboard',
    description: 'Your dashboard brings your nutrition plan and health insights together in one place.',
  },
  {
    target: '[data-dashboard-tour="check-in"]',
    title: 'Check in with yourself',
    description: 'Choose a mood to get a quick note about how BLANE considers your energy, recovery, and food balance today.',
  },
  {
    target: '[data-dashboard-tour="meal-plan"]',
    title: 'Your meals for today',
    description: 'Switch between meal times to review recipes, ingredients, macros, prep time, and estimated cost. The bar tracks calories and protein against your daily goal. Open Meal Plan to make changes.',
  },
  {
    target: '[data-dashboard-tour="body-stats"]',
    title: 'Your BMI and body stats',
    description: 'See your BMI category and range, height, weight, BMI index, and estimated healthy weight range from your profile.',
  },
  {
    target: '[data-dashboard-tour="recommendations"]',
    title: 'Recommendations picked for you',
    description: 'Review recipe matches with their match scores, nutrition, cost, and reasons they fit your goal and dietary profile. Select a recipe or view all recipes to explore.',
  },
  {
    target: '[data-dashboard-tour="feedback"]',
    title: 'Log your daily health',
    description: 'Record weight, sleep, water, and calories burned. BLANE uses your entries to refresh nutrition targets, show alerts, and track your recent history.',
  },
  {
    target: '[data-dashboard-tour="drift"]',
    title: 'Follow your health trends',
    description: 'Health Drift Detection summarizes your recent weight, sleep, hydration, and BMI trends in a health score. Log at least two days of data to see the analysis.',
  },
];

export default function DashboardTour({ isOpen, onClose }) {
  return <GuidedTour isOpen={isOpen} onClose={onClose} title="Dashboard tour" steps={TOUR_STEPS} />;
}
