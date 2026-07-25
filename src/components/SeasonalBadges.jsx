/* ============================================================
   BLANE — Seasonal Badge Components
   Replaces: badgeHTML(), ingTagHTML(), altBannerHTML(), and
   currentSeasonPillHTML() from js/seasonal.js.
   ============================================================ */
import { getCurrentSeason, getIngredientStatus } from '../lib/seasonal';
import '../styles/seasonal.css';

const SEASON_ICONS = { 'in-season': '🌿', partial: '🌤️', 'out-of-season': '🌧️', 'year-round': '📅' };

export function SeasonBadge({ scoreResult }) {
  const icon = SEASON_ICONS[scoreResult.cssClass] || '📅';
  return <span className={'season-badge ' + scoreResult.cssClass}>{icon} {scoreResult.label}</span>;
}

export function IngSeasonTag({ ingredientName }) {
  const result = getIngredientStatus(ingredientName);
  const labels = { in_season: '🌿 In Season', out_of_season: '🌧️ Out of Season', year_round: '📅 Year-Round' };
  const classes = { in_season: 'in-season', out_of_season: 'out-of-season', year_round: 'year-round' };
  return <span className={'ing-season-tag ' + classes[result.status]}>{labels[result.status]}</span>;
}

export function SeasonalAltBanner({ ingredientName }) {
  const result = getIngredientStatus(ingredientName);
  if (result.status !== 'out_of_season' || !result.alt) return null;

  const season = getCurrentSeason();
  const seasonLabel = season === 'wet' ? '🌧️ Wet Season' : '☀️ Dry Season';

  return (
    <div className="seasonal-alt-banner">
      <span className="seasonal-alt-icon">💡</span>
      <div className="seasonal-alt-text">
        <strong>{ingredientName}</strong> is out of season during the {seasonLabel}. Try{' '}
        <strong>{result.alt}</strong> as a fresher, more affordable alternative right now.
      </div>
    </div>
  );
}

export function CurrentSeasonPill() {
  const season = getCurrentSeason();
  const month = new Date().toLocaleString('en-PH', { month: 'long' });
  const label = season === 'wet' ? '🌧️ Wet Season — ' + month : '☀️ Dry Season — ' + month;
  return <span className={'current-season-pill ' + season}>{label}</span>;
}