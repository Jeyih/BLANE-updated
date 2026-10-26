import { philippineClock } from './meal-experience.js';

// Each retry addresses the same owner/day row, including after an uncertain response.
export function createHealthLogSaver(client, { now = () => new Date(), timeoutMs = 15000 } = {}) {
  const pending = new Map();
  return function save(profile, values) {
    if (!profile?.id) return Promise.reject(new Error('Sign in before saving health data.'));
    const timestamp = now();
    const day = philippineClock(timestamp).dateKey;
    const key = `${profile.id}:${day}`;
    if (pending.has(key)) return pending.get(key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const job = (async () => {
      let logConfirmed = false;
      try {
        const { error } = await client.from('health_logs').upsert({
          ...values, user_id: profile.id, logged_at: day, updated_at: timestamp.toISOString(),
        }, { onConflict: 'user_id,logged_at' }).abortSignal(controller.signal);
        if (error) throw error;
        logConfirmed = true;
        if (values.weight_kg != null && values.weight_kg !== Number(profile.weight_kg)) {
          const { error: profileError } = await client.from('profiles').upsert({
            id: profile.id, weight_kg: values.weight_kg, updated_at: timestamp.toISOString(),
          }).abortSignal(controller.signal);
          if (profileError) throw profileError;
          return { ...profile, weight_kg: values.weight_kg };
        }
        return profile;
      } catch {
        throw new Error(logConfirmed
          ? 'Health log saved, but profile weight could not be confirmed. Check your connection and retry.'
          : 'Could not confirm the health log was saved. Check your connection and retry; this updates the same daily entry.');
      } finally { clearTimeout(timeout); }
    })();
    pending.set(key, job);
    job.then(() => pending.delete(key), () => pending.delete(key));
    return job;
  };
}
