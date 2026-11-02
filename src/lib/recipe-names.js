export function recipeDisplayName(name) {
  return String(name || '').replace(/\s*\(adapted\)/gi, '').replace(/\s+adapted\s*$/i, '').trim();
}
