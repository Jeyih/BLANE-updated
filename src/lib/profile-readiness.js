import { ACTIVITY_MULT, GOAL_ADJUST, validateMeasurements } from '../../supabase/functions/_shared/nutrition.js';

export function isProfileComplete(profile) {
  return Boolean(profile && !validateMeasurements(profile)
    && ['male', 'female'].includes(profile.sex)
    && Object.hasOwn(ACTIVITY_MULT, profile.activity_level)
    && Object.hasOwn(GOAL_ADJUST, profile.goal));
}
