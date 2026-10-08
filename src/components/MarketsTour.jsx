import GuidedTour from './GuidedTour';

const TOUR_STEPS = [
  {
    target: '[data-markets-tour="header"]',
    title: 'Welcome to GeoMarket Scanner',
    description: 'Explore nearby markets around the displayed area and use the live market data to plan where to shop.',
  },
  {
    target: '[data-markets-tour="location"]',
    title: 'Set your location',
    description: 'Use Update Location to request your device’s GPS position and update distances. Your browser may ask for location permission.',
  },
  {
    target: '[data-markets-tour="hubs"]',
    title: 'Jump to a quick hub',
    description: 'Choose a preset Tarlac area to center the map and recalculate how far each market is from that hub.',
  },
  {
    target: '[data-markets-tour="filters"]',
    title: 'Filter nearby market types',
    description: 'Show all nearby markets or narrow the results to palengkes, supermarkets, talipapas, or groceries. The count shows how many match.',
  },
  {
    target: '[data-markets-tour="map"]',
    title: 'Explore the map',
    description: 'Colored pins distinguish market types. Select a pin to focus its market, and use the controls to zoom or recenter the map. The legend explains the pin colors.',
  },
  {
    target: '[data-markets-tour="list"]',
    title: 'Compare nearby stores',
    description: 'The list is sorted by distance and shows each store’s type, distance, open status, and ingredients from your meal plan.',
  },
  {
    target: '[data-markets-tour="list"]',
    title: 'Click a store to open it',
    description: 'Click any store card in the list above. Its details will open below, and Next will become available once a store is selected.',
    requiresSelection: true,
  },
  {
    target: '[data-markets-tour="details"]',
    title: 'Store details and ingredient prices',
    description: 'The selected store shows its type, open status, distance, hours, and address. Scroll the ingredient table to compare quantities, prices, availability, and seasonal tags. When your location is set, the map can also show a driving route.',
  },
];

export default function MarketsTour({ isOpen, onClose, hasSelectedMarket }) {
  return (
    <GuidedTour
      isOpen={isOpen}
      onClose={onClose}
      title="Markets tour"
      steps={TOUR_STEPS}
      canContinue={hasSelectedMarket}
    />
  );
}
