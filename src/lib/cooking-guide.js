const NOTE_TITLES = /^(weighed ingredient inputs|qualified review required|nutrition and costing basis|nutrition basis|costing basis)$/i;
const SHORT_TITLES = { 'Preparation': 'Prepare and cook', 'Serve the recorded portion': 'Serve', 'Cook aromatics': 'Cook the onion and garlic' };

// Presentation-only edits. Keep the stored recipe, quantities and review rules intact.
function plainCookingText(text) {
  return String(text || '')
    .replace('Wash and peel the potatoes and carrot, weigh the listed prepared raw inputs, then cut into even pieces.', 'Wash and peel the potatoes and carrot. Weigh the amounts shown above. Cut them into even pieces.')
    .replace('Wash, trim and weigh the prepared raw vegetables.', 'Wash and trim the vegetables. Weigh the amounts shown above.')
    .replace('Wash, peel or trim, and weigh the prepared raw vegetables.', 'Wash and peel or trim the vegetables. Weigh the amounts shown above.')
    .replace('Toss with the measured coconut oil and serve warm.', 'Mix with the listed amount of coconut oil. Serve warm.')
    .replace('Stir in the measured coconut oil.', 'Stir in the listed amount of coconut oil.')
    .replace('Serve the entire prepared batch as one portion.', 'Serve the whole batch as one serving.')
    .replace('Serve the entire prepared batch as one serving.', 'Serve the whole batch as one serving.');
}

export function cookingGuide(steps = []) {
  const cooking = [];
  const notes = [];
  for (const step of steps) {
    const title = String(step.title || '').trim();
    const description = String(step.desc ?? step.description ?? '');
    if (NOTE_TITLES.test(title)) { notes.push({ title, desc: description }); continue; }
    const lines = plainCookingText(description).split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
    // Keep origin/context and medical statements available, outside cooking actions.
    const actions = [];
    for (const line of lines) {
      if (/^This is a simple\b|^Calories and carbohydrate amounts\b|^Do not add unlisted\b/.test(line)) {
        notes.push({ title: 'Recipe note', desc: line });
      } else actions.push(line);
    }
    if (actions.length) cooking.push({ title: SHORT_TITLES[title] || title || 'Cook', lines: actions, timer: step.timer });
  }
  return { cooking, notes };
}
