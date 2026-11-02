export const SEX_CHOICES = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export function isSexChoice(value) {
  return SEX_CHOICES.some(choice => choice.value === value);
}

export function sexChoiceLabel(value) {
  return SEX_CHOICES.find(choice => choice.value === value)?.label || '—';
}

export const UNDISCLOSED_SEX_NOTE = 'If you prefer not to say, calorie-based personalization is off. You can still browse recipes and plan meals manually.';
