import React from 'react';
import GuidedTour from './GuidedTour';
const TOUR_STEPS = [
  {
    target: '[data-markets-tour="header"]',
    title: 'Welcome to GeoMarket Scanner',
    description:
      'Explore listed Tarlac City markets and find ingredients from your selected day’s meal plan.',
  },
  {
    target: '[data-markets-tour="location"]',
    title: 'Set your location',
    description:
      'Use Update Location to request your device\u2019s GPS position and update distances. Your browser may ask for location permission.',
  },
  {
    target: '[data-markets-tour="pin"]',
    title: 'Pin your location',
    description:
      'If GPS is unavailable, select Pin location and click the map. Distances update while market coverage stays within Tarlac City.',
  },
  {
    target: '[data-markets-tour="filters"]',
    title: 'Filter nearby market types',
    description:
      'Show all listed Tarlac City markets or filter by palengke, supermarket, talipapa, or grocery. The count shows how many match.',
  },
  {
    target: '[data-markets-tour="map"]',
    title: 'Explore the map',
    description:
      'Colored pins distinguish market types. Select a pin to focus its market, and use the controls to zoom or recenter the map. The legend explains the pin colors.',
  },
  {
    target: '[data-markets-tour="list"]',
    title: 'Compare nearby stores',
    description:
      'The list is sorted by distance and shows each store\u2019s type, distance, open status, and ingredients from your selected day’s meals that the store carries.',
  },
  {
    target: '[data-markets-tour="list"]',
    title: 'Click a store to open it',
    description:
      'Click any store card in the list above. Its details will open below, and Next will become available once a store is selected.',
    requiresSelection: true,
  },
  {
    target: '[data-markets-tour="details"]',
    title: 'Store details and ingredient prices',
    description:
      'The selected store shows its type, open status, distance, hours, and address. Scroll the ingredient table to compare quantities, prices, availability, and seasonal tags. When your location is set, the map can also show a driving route.',
  },
];
function MarketsTour({ isOpen, onClose, hasSelectedMarket }) {
  return React.createElement(GuidedTour, {
    isOpen,
    onClose,
    title: 'Markets tour',
    steps: TOUR_STEPS,
    canContinue: hasSelectedMarket,
  });
}
export { MarketsTour as default };
