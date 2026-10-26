import { validateMeasurements } from '../../supabase/functions/_shared/nutrition.js';
import { asList } from './constraint-rules.js';

// Older setup allowed an empty activity field. Keep those saved profiles;
// users can fill that field in Profile without repeating registration setup.
export function hasInitialProfile(profile) {
  return Boolean(profile && !validateMeasurements(profile)
    && ['male', 'female'].includes(profile.sex) && profile.goal);
}

export function onboardingFormFromProfile(profile, name = '') {
  return {
    fullName: profile?.full_name || name,
    age: profile?.age ?? '', sex: profile?.sex || '',
    height: profile?.height_cm ?? '', weight: profile?.weight_kg ?? '',
    activity: profile?.activity_level || '', goal: profile?.goal || '',
    dietary: asList(profile?.dietary_restrictions), dietaryOther: '',
    medical: asList(profile?.medical_conditions), medicalOther: '',
    allergies: asList(profile?.allergies), allergiesOther: '',
  };
}
