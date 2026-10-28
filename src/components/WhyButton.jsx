import { nutritionProfile, mealForAi } from '../../supabase/functions/_shared/nutrition.js';
import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import '../styles/explainai.css';
import { mealReviewKey } from '../lib/meal-review';
function getExplainMealUrl() {
  return SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co') + '/explain-meal';
}
const VERDICT_ICONS = { safe: '\u2705', caution: '\u26A0\uFE0F', avoid: '\u{1F6AB}' };
const explanationCache = new Map();
async function requestMealExplanation(meal, profile, violations) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
  const res = await fetch(getExplainMealUrl(), {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.access_token,
    },
    body: JSON.stringify({
      mealId: meal.id,
      meal: { ...mealForAi(meal), constraintWarnings: violations },
      profile: nutritionProfile(profile),
      constraintWarnings: violations,
    }),
  });
  if (!res.ok || !res.body) throw new Error('AI service returned an error.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let verdict = null;
  function readEvent(line) {
    if (!line.startsWith('data: ')) return;
    const json = line.slice(6).trim();
    if (!json) return;
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      return;
    }
    if (parsed.error) throw new Error(parsed.error);
    if (parsed.verdict) {
      const status = String(parsed.verdict).toLowerCase();
      if (['safe', 'caution', 'avoid'].includes(status)) {
        verdict = {
          verdict: status,
          label: parsed.verdict_label,
          flagged: parsed.flagged_condition,
        };
      }
    }
    if (parsed.text) text += parsed.text;
  }
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(readEvent);
  }
  if (buffer) readEvent(buffer);
  if (!verdict) throw new Error('AI response did not include a safety verdict.');
  if (!text)
    throw new Error('BLANE AI could not generate an explanation right now. Please try again.');
  // An AI verdict cannot override a conflict already detected by local rules.
  if (violations.length && verdict.verdict === 'safe') {
    verdict = { verdict: 'caution', label: 'Recorded dietary warnings require review.' };
  }
  return { verdict, text };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('AI explanation timed out. You can keep using the site and try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function getMealExplanation(meal, profile, violations) {
  const key = mealReviewKey(meal, profile, violations);
  if (!explanationCache.has(key)) {
    const request = requestMealExplanation(meal, profile, violations).catch((error) => {
      explanationCache.delete(key);
      throw error;
    });
    explanationCache.set(key, request);
  }
  return explanationCache.get(key);
}
function WhyButton({ meal, profile, violations = [], onReview }) {
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, arrowBottom: false });
  const btnRef = useRef(null);
  const popoverRef = useRef(null);
  const contentRef = useRef(null);
  const aiStatus = ['safe', 'caution', 'avoid'].includes(verdict?.verdict) ? verdict.verdict : null;
  const requestKey = mealReviewKey(meal, profile, violations);
  const onReviewRef = useRef(onReview);
  onReviewRef.current = onReview;
  function toggle() {
    if (error) setRetryCount((count) => count + 1);
    setOpen((wasOpen) => !wasOpen);
  }
  function close() {
    setOpen(false);
  }
  useEffect(() => {
    let active = true;
    setVerdict(null);
    setText('');
    setError('');
    setStreaming(true);
    getMealExplanation(meal, profile, violations)
      .then((result) => {
        if (!active) return;
        setVerdict(result.verdict);
        setText(result.text);
        onReviewRef.current?.(result.verdict);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Explain AI error:', err);
        setError(err.message || 'Could not reach BLANE AI. Check your connection and try again.');
      })
      .finally(() => {
        if (active) setStreaming(false);
      });
    return () => {
      active = false;
    };
  }, [requestKey, retryCount]);
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
  useEffect(() => {
    if (open) positionPopover();
  }, [text, verdict, open]);
  useEffect(() => {
    if (open && contentRef.current) contentRef.current.scrollTop = 0;
  }, [open]);
  useEffect(() => {
    if (open && !streaming && contentRef.current) contentRef.current.scrollTop = 0;
  }, [open, streaming]);
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'button',
      {
        ref: btnRef,
        className: `xai-why-btn${aiStatus ? ` status-${aiStatus}` : ' status-pending'}`,
        title: aiStatus ? `AI verdict: ${aiStatus}` : 'BLANE AI is reviewing this meal automatically',
        onClick: (e) => {
          e.stopPropagation();
          toggle();
        },
      },
      React.createElement(
        'svg',
        {
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '2',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
        React.createElement('path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }),
        React.createElement('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }),
      ),
      aiStatus ? ` ${aiStatus.toUpperCase()}, See why?` : ' See why?',
    ),
    open &&
      createPortal(
        React.createElement(
          React.Fragment,
          null,
          React.createElement('div', { className: 'xai-overlay', onClick: close }),
          React.createElement(
            'div',
            {
              ref: popoverRef,
              className: 'xai-popover' + (position.arrowBottom ? ' arrow-bottom' : ''),
              style: { left: position.left, top: position.top },
            },
            React.createElement(
              'div',
              { className: 'xai-pop-header' },
              React.createElement(
                'div',
                { className: 'xai-pop-header-left' },
                React.createElement('div', { className: 'xai-pop-icon' }, '\u2728'),
                React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'div',
                    { className: 'xai-pop-title' },
                    'Meal Suitability Review',
                  ),
                  React.createElement('div', { className: 'xai-pop-meal' }, meal.name),
                ),
              ),
              React.createElement(
                'button',
                { className: 'xai-pop-close', onClick: close },
                '\u2715',
              ),
            ),
            React.createElement(
              'div',
              { ref: contentRef, className: 'xai-pop-content' },
              violations.length > 0 &&
                React.createElement(
                  'div',
                  { className: 'xai-warning-context' },
                  React.createElement('strong', null, 'Detected meal warnings'),
                  violations.map((violation, index) =>
                    React.createElement(
                      'div',
                      {
                        className: 'xai-warning-item warning-' + violation.severity,
                        key: `${violation.severity}-${violation.ingredient}-${index}`,
                      },
                      React.createElement(
                        'span',
                        null,
                        violation.icon,
                        ' ',
                        violation.constraintLabel,
                      ),
                      React.createElement(
                        'span',
                        null,
                        violation.ingredient,
                        ': ',
                        violation.reason,
                      ),
                    ),
                  ),
                ),
              verdict &&
                React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'div',
                    { className: 'xai-verdict-badge xai-verdict-' + verdict.verdict },
                    React.createElement(
                      'span',
                      { className: 'xai-verdict-icon' },
                      VERDICT_ICONS[verdict.verdict] || '\u2705',
                    ),
                    React.createElement('span', { className: 'xai-verdict-label' }, verdict.label),
                  ),
                  verdict.verdict === 'avoid' &&
                    verdict.flagged &&
                    React.createElement('div', { className: 'xai-flagged-note' }, verdict.flagged),
                ),
              React.createElement(
                'div',
                { className: 'xai-explanation' },
                error
                  ? React.createElement('div', { className: 'xai-error' }, error)
                  : !text && streaming
                    ? React.createElement(
                        'div',
                        { className: 'xai-thinking' },
                        React.createElement('span', { className: 'xai-dot' }),
                        React.createElement('span', { className: 'xai-dot' }),
                        React.createElement('span', { className: 'xai-dot' }),
                        ' Asking BLANE AI\u2026',
                      )
                    : React.createElement(
                        React.Fragment,
                        null,
                        React.createElement('span', { className: 'xai-stream-text' }, text),
                        streaming && React.createElement('span', { className: 'xai-cursor' }),
                      ),
              ),
            ),
            React.createElement(
              'div',
              { className: 'xai-pop-footer' },
              React.createElement(
                'span',
                { className: 'xai-model-badge' },
                '\u2728 Gemini 2.5 Flash Lite',
              ),
              'Grounded in DOST-FNRI data & your profile',
            ),
          ),
        ),
        document.body,
      ),
  );
}
export { WhyButton as default };
