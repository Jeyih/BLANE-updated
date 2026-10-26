import test from 'node:test';
import assert from 'node:assert/strict';
import { hasInitialProfile, onboardingFormFromProfile } from './onboarding-profile.js';
import { isProfileComplete } from './profile-readiness.js';
const saved = { full_name:'Sample',age:25,sex:'male',height_cm:165,weight_kg:65,activity_level:'light',goal:'maintain',dietary_restrictions:['vegan'],medical_conditions:['diabetes'],allergies:['egg_allergy','Custom allergy'] };
test('existing completed registration profiles skip initial setup on subsequent logins', () => {
  assert.equal(hasInitialProfile(saved),true);
  assert.equal(hasInitialProfile({...saved,full_name:'Edited in Profile',weight_kg:66}),true);
  assert.equal(hasInitialProfile(null),false);
  assert.equal(hasInitialProfile({full_name:'New account'}),false);
});
test('legacy saved profiles do not repeat setup for the formerly optional activity field', () => {
  const legacy = {...saved,activity_level:''};
  assert.equal(hasInitialProfile(legacy),true);
  assert.equal(isProfileComplete(legacy),false); // No invented activity/calorie target.
});
test('unfinished setup reloads the saved fields and preserves restrictions and custom entries', () => {
  const original = structuredClone(saved);
  const form=onboardingFormFromProfile(saved,'Account name');
  assert.equal(form.fullName,'Sample');
  assert.equal(form.age,25); assert.equal(form.height,165); assert.equal(form.weight,65);
  assert.equal(form.activity,'light'); assert.equal(form.goal,'maintain');
  assert.deepEqual(form.dietary,['vegan']); assert.deepEqual(form.medical,['diabetes']);
  assert.deepEqual(form.allergies,['egg_allergy','Custom allergy']);
  form.allergies.push('Form-only edit');
  assert.deepEqual(saved,original);
});
test('a new account receives blank measurements rather than another user’s details', () => {
  const fresh=onboardingFormFromProfile(null,'New user');
  assert.equal(fresh.fullName,'New user'); assert.equal(fresh.height,''); assert.equal(fresh.weight,'');
  assert.deepEqual(fresh.dietary,[]); assert.deepEqual(fresh.medical,[]); assert.deepEqual(fresh.allergies,[]);
});
