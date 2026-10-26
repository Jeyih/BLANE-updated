import test from 'node:test';
import assert from 'node:assert/strict';
import { isProfileComplete } from './profile-readiness.js';
const complete = { age:25, sex:'male', height_cm:165, weight_kg:65, activity_level:'light', goal:'maintain' };
test('personalized planning requires every calculation input, including activity and goal', () => {
  assert.equal(isProfileComplete(complete), true);
  for (const key of Object.keys(complete)) {
    const missing = { ...complete }; delete missing[key];
    assert.equal(isProfileComplete(missing), false, key);
  }
  assert.equal(isProfileComplete(null), false);
  assert.equal(isProfileComplete({ goal:'maintain' }), false);
});
test('invalid or unsupported values cannot silently use target defaults', () => {
  for (const [key,value] of [['age',1.5],['height_cm',0],['weight_kg',-1],['activity_level','unknown'],['goal','unknown'],['sex','unknown']]) {
    assert.equal(isProfileComplete({...complete,[key]:value}), false);
  }
});
