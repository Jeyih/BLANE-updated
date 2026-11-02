import { asList } from './constraint-rules.js';

export function customProfileEntries(values, options) {
  const keys = new Set(options.map(option => option.key));
  return [...new Set(asList(values))].filter(value => !keys.has(value));
}

export function replaceProfileEntry(values, previous, next) {
  const replacement = next.trim();
  if (!replacement) throw new Error('Enter a value, or choose Remove to delete this entry.');
  return [...new Set(asList(values).map(value => value === previous ? replacement : value))];
}

export function removeProfileEntry(values, value) {
  return asList(values).filter(entry => entry !== value);
}

export function addProfileEntry(values, text) {
  const entry = text.trim();
  if (!entry) throw new Error('Enter a value first.');
  const existing = asList(values);
  return existing.some(value => value.toLowerCase() === entry.toLowerCase()) ? existing : [...existing, entry];
}
