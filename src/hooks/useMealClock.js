import { useEffect, useState } from 'react';
export default function useMealClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer;
    const tick = () => {
      clearTimeout(timer);
      setNow(new Date());
      // Recheck at the minute boundary so cutoffs change while the page stays open.
      timer = setTimeout(tick, 60_000 - Date.now() % 60_000);
    };
    tick();
    window.addEventListener('focus', tick);
    window.addEventListener('blane-meal-plan-updated', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearTimeout(timer); window.removeEventListener('focus', tick); window.removeEventListener('blane-meal-plan-updated', tick); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}
