import React from 'react';
import { getCurrentSeason, getIngredientStatus } from '../lib/seasonal';
import '../styles/seasonal.css';
const SEASON_ICONS = {
  unknown: '\u2753',
  'in-season': '\u{1F33F}',
  partial: '\u{1F324}\uFE0F',
  'out-of-season': '\u{1F327}\uFE0F',
  'year-round': '\u{1F4C5}',
};
function SeasonBadge({ scoreResult }) {
  const icon = SEASON_ICONS[scoreResult.cssClass] || '\u{1F4C5}';
  return React.createElement(
    'span',
    { className: 'season-badge ' + scoreResult.cssClass },
    icon,
    ' ',
    scoreResult.label,
  );
}
function IngSeasonTag({ ingredientName }) {
  const result = getIngredientStatus(ingredientName);
  const labels = {
    unknown: 'Season unknown',
    in_season: '\u{1F33F} In Season',
    out_of_season: '\u{1F327}\uFE0F Out of Season',
    year_round: '\u{1F4C5} Year-Round',
  };
  const classes = {
    unknown: 'unknown',
    in_season: 'in-season',
    out_of_season: 'out-of-season',
    year_round: 'year-round',
  };
  return React.createElement(
    'span',
    { className: 'ing-season-tag ' + classes[result.status] },
    labels[result.status],
  );
}
function SeasonalAltBanner({ ingredientName }) {
  const result = getIngredientStatus(ingredientName);
  if (result.status !== 'out_of_season' || !result.alt) return null;
  const season = getCurrentSeason();
  const seasonLabel = season === 'wet' ? '\u{1F327}\uFE0F Wet Season' : '\u2600\uFE0F Dry Season';
  return React.createElement(
    'div',
    { className: 'seasonal-alt-banner' },
    React.createElement('span', { className: 'seasonal-alt-icon' }, '\u{1F4A1}'),
    React.createElement(
      'div',
      { className: 'seasonal-alt-text' },
      React.createElement('strong', null, ingredientName),
      ' is out of season during the ',
      seasonLabel,
      '. Try',
      ' ',
      React.createElement('strong', null, result.alt),
      ' as a fresher, more affordable alternative right now.',
    ),
  );
}
function CurrentSeasonPill() {
  const season = getCurrentSeason();
  const month = new Date().toLocaleString('en-PH', { month: 'long' });
  const label =
    season === 'wet'
      ? '\u{1F327}\uFE0F Wet Season \u2014 ' + month
      : '\u2600\uFE0F Dry Season \u2014 ' + month;
  return React.createElement('span', { className: 'current-season-pill ' + season }, label);
}
export { CurrentSeasonPill, IngSeasonTag, SeasonBadge, SeasonalAltBanner };
