import React from 'react';
function PriceEstimateNotice() {
  return React.createElement(
    'p',
    { className: 'price-estimate-note', role: 'note' },
    'Prices are estimates in Philippine pesos. Actual store totals may vary. Estimates update automatically.',
  );
}
export { PriceEstimateNotice as default };
