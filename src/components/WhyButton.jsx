/* ============================================================
   BLANE — Explainable AI "Why?" Button (Module 07)
   Replaces: js/explainai.js entirely.

   Self-contained button + popover: renders its own trigger and
   manages its own open/close/streaming state. Uses a React
   portal to document.body so the popover behaves exactly like
   the old version (fixed-position, escapes any parent overflow
   clipping on meal cards).
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import '../styles/explainai.css';

function getExplainMealUrl() {
  return SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co') + '/explain-meal';
}

const VERDICT_ICONS = { safe: '✅', caution: '⚠️', avoid: '🚫' };

export default function WhyButton({ meal, profile, violations = [] }) {
  const [open, setOpen]           = useState(false);
  const [verdict, setVerdict]     = useState(null);
  const [text, setText]           = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError]         = useState('');
  const [position, setPosition]   = useState({ left: 0, top: 0, arrowBottom: false });

  const btnRef     = useRef(null);
  const popoverRef = useRef(null);
  const contentRef = useRef(null);
  const abortRef   = useRef(null);
  const severityOrder = { allergy: 0, medical: 1, dietary: 2 };
  const primaryViolation = [...violations].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])[0];
  const mealStatus = primaryViolation?.severity === 'allergy'
    ? 'Avoid'
    : primaryViolation ? 'Caution' : 'Safe';

  function toggle() {
    if (open) { close(); return; }
    openAndStream();
  }

  function close() {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setOpen(false);
  }

  async function openAndStream() {
    setOpen(true);
    setVerdict(null);
    setText('');
    setError('');
    setStreaming(true);
    positionPopover();

    abortRef.current = new AbortController();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const res = await fetch(getExplainMealUrl(), {
        method: 'POST',
        signal: abortRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({
          mealId: meal.id,
          meal: { ...meal, constraintWarnings: violations },
          profile,
          constraintWarnings: violations,
        }),
      });

      if (!res.ok || !res.body) throw new Error('AI service returned an error.');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let gotAnyText = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let parsed;
          try { parsed = JSON.parse(jsonStr); } catch { continue; }

          if (parsed.error) { setError(parsed.error); setStreaming(false); return; }
          if (parsed.verdict) {
            setVerdict({ verdict: parsed.verdict, label: parsed.verdict_label, flagged: parsed.flagged_condition });
          }
          if (parsed.text) {
            gotAnyText = true;
            setText((t) => t + parsed.text);
          }
          if (parsed.done) setStreaming(false);
        }
      }

      if (!gotAnyText) {
        setError('BLANE AI could not generate an explanation right now. Please try again.');
      }
      setStreaming(false);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Explain AI error:', err);
      setError('⚠️ Could not reach BLANE AI. Check your connection and try again.');
      setStreaming(false);
    }
  }

  function positionPopover() {
    if (!btnRef.current) return;
    const btnRect = btnRef.current.getBoundingClientRect();
    const vpW = window.innerWidth;
    const popW = popoverRef.current?.offsetWidth || Math.min(420, vpW - 16);
    const popH = popoverRef.current?.offsetHeight || 220;
    const vpH = window.innerHeight;
    const margin = 8;

    let left = btnRect.left;
    if (left + popW > vpW - margin) left = vpW - popW - margin;
    if (left < margin) left = margin;

    let top = btnRect.bottom + 10;
    let arrowBottom = false;
    if (top + popH > vpH - margin) {
      top = Math.max(margin, btnRect.top - popH - 10);
      arrowBottom = true;
    }

    setPosition({ left, top, arrowBottom });
  }

  /* Reposition as text streams in and grows the popover height */
  useEffect(() => {
    if (open) positionPopover();
  }, [text, verdict, open]);

  useEffect(() => {
    if (open && contentRef.current) contentRef.current.scrollTop = 0;
  }, [open]);

  useEffect(() => {
    if (open && !streaming && contentRef.current) contentRef.current.scrollTop = 0;
  }, [open, streaming]);

  /* Close on outside click / ESC */
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className={`xai-why-btn status-${mealStatus.toLowerCase()}` + (primaryViolation ? ` warning warning-${primaryViolation.severity}` : '')}
        title={primaryViolation ? `Explain ${violations.length} meal warning${violations.length === 1 ? '' : 's'}` : 'Explain this meal'}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {` ${mealStatus}, See why?`}
      </button>

      {open && createPortal(
        <>
          <div className="xai-overlay" onClick={close} />
          <div
            ref={popoverRef}
            className={'xai-popover' + (position.arrowBottom ? ' arrow-bottom' : '')}
            style={{ left: position.left, top: position.top }}
          >
            <div className="xai-pop-header">
              <div className="xai-pop-header-left">
                <div className="xai-pop-icon">✨</div>
                <div>
                  <div className="xai-pop-title">{violations.length ? 'Why This Meal Has Warnings' : 'Why Recommended?'}</div>
                  <div className="xai-pop-meal">{meal.name}</div>
                </div>
              </div>
              <button className="xai-pop-close" onClick={close}>✕</button>
            </div>

            <div ref={contentRef} className="xai-pop-content">
              {violations.length > 0 && (
                <div className="xai-warning-context">
                  <strong>Detected meal warnings</strong>
                  {violations.map((violation, index) => (
                    <div className={'xai-warning-item warning-' + violation.severity} key={`${violation.severity}-${violation.ingredient}-${index}`}>
                      <span>{violation.icon} {violation.constraintLabel}</span>
                      <span>{violation.ingredient}: {violation.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {verdict && (
                <div>
                  <div className={'xai-verdict-badge xai-verdict-' + verdict.verdict}>
                    <span className="xai-verdict-icon">{VERDICT_ICONS[verdict.verdict] || '✅'}</span>
                    <span className="xai-verdict-label">{verdict.label}</span>
                  </div>
                  {verdict.verdict === 'avoid' && verdict.flagged && (
                    <div className="xai-flagged-note">{verdict.flagged}</div>
                  )}
                </div>
              )}

              <div className="xai-explanation">
                {error ? (
                  <div className="xai-error">{error}</div>
                ) : !text && streaming ? (
                  <div className="xai-thinking">
                    <span className="xai-dot"></span><span className="xai-dot"></span><span className="xai-dot"></span>
                    {' Asking BLANE AI…'}
                  </div>
                ) : (
                  <>
                    <span className="xai-stream-text">{text}</span>
                    {streaming && <span className="xai-cursor"></span>}
                  </>
                )}
              </div>
            </div>

            <div className="xai-pop-footer">
              <span className="xai-model-badge">✨ Gemini 2.5 Flash Lite</span>
              Grounded in DOST-FNRI data &amp; your profile
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}