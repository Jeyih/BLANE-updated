import { asList } from './constraint-rules.js';
import { GOAL_ADJUST } from '../../supabase/functions/_shared/nutrition.js';

export const MAX_HEALTH_GOALS = 3;

// The existing scalar goal remains the primary goal for every calorie calculation.
export function selectedHealthGoals(profile) {
  return [...new Set([profile?.goal, ...asList(profile?.health_goals)].filter(Boolean))];
}

export function toggleHealthGoal(profile, key) {
  const selected = selectedHealthGoals(profile);
  const next = selected.includes(key)
    ? selected.filter(goal => goal !== key)
    : selected.length < MAX_HEALTH_GOALS ? [...selected, key] : selected;
  return { goal: next[0] || '', health_goals: next };
}

export function primaryHealthGoal(profile, key) {
  const selected = selectedHealthGoals(profile);
  if (!selected.includes(key)) return { goal: profile.goal || '', health_goals: selected };
  return { goal: key, health_goals: [key, ...selected.filter(goal => goal !== key)] };
}

export function healthGoalError(profile) {
  const selected = selectedHealthGoals(profile);
  if (!profile?.goal || !selected.length) return 'Please choose at least one health goal.';
  if (selected.length > MAX_HEALTH_GOALS) return 'Choose up to three health goals.';
  if (selected.some(key => !Object.hasOwn(GOAL_ADJUST, key))) return 'Please choose a supported health goal.';
  return '';
}

export function healthGoalFields(profile) {
  return { goal: profile.goal, health_goals: selectedHealthGoals(profile) };
}

export async function saveHealthProfile(client, payload) {
  const validationError = healthGoalError(payload);
  if (validationError) return { error: { message: validationError } };
  let result;
  try {
    result = await client.from('profiles').upsert(payload);
  } catch {
    return { error: { message: 'Could not save your health goals. Check your connection and try again.' } };
  }
  const error = result.error;
  if (error?.code === '23514' && payload.sex === 'prefer_not_to_say' && /sex/i.test(error.message || '')) {
    return { error: { ...error, message: 'The server does not support “Prefer not to say” yet. An administrator needs to apply the profile privacy database update. Your choice has not been changed.' } };
  }
  const missingColumn = error && ['PGRST204', '42703'].includes(error.code)
    && /health_goals/i.test(error.message || '');
  if (!missingColumn) return result;
  // Keep single-goal registration working until the additive migration is deployed.
  // Multiple selections must never be silently discarded.
  if (selectedHealthGoals(payload).length > 1) {
    return { error: { ...error, message: 'Multiple health goals are not enabled on the server yet. The administrator needs to apply the health-goals database update.' } };
  }
  const { health_goals, ...legacyPayload } = payload;
  try {
    return await client.from('profiles').upsert(legacyPayload);
  } catch {
    return { error: { message: 'Could not save your health goals. Check your connection and try again.' } };
  }
}
