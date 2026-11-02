// Reuse the session already stored by Supabase; do not create another token copy.
export function readSavedSession(url, storage = globalThis.localStorage) {
  try {
    const host = new URL(url).hostname.split('.')[0];
    const saved = JSON.parse(storage.getItem(`sb-${host}-auth-token`));
    return saved?.user?.id && saved?.access_token ? saved : null;
  } catch { return null; }
}
