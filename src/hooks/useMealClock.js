import { useEffect, useState } from 'react';
function useMealClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer;
    const tick = () => {
      clearTimeout(timer);
      setNow(new Date());
      timer = setTimeout(tick, 6e4 - (Date.now() % 6e4));
    };
    tick();
    window.addEventListener('focus', tick);
    window.addEventListener('blane-meal-plan-updated', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', tick);
      window.removeEventListener('blane-meal-plan-updated', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}
export { useMealClock as default };
