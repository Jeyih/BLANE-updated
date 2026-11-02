import React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lockTourInteraction } from '../lib/tour-interaction.js';
import '../styles/guided-tour.css';
function GuidedTour({ isOpen, onClose, title, steps, canContinue = true }) {
  const [stepIndex, setStepIndex] = useState(0);
  const cardRef = useRef(null);
  const focusBeforeTour = useRef(null);
  const step = steps[stepIndex];
  const [smallScreen, setSmallScreen] = useState(() => window.innerWidth <= 640);
  const [dockHost, setDockHost] = useState(null);
  useEffect(() => {
    const resize = () => setSmallScreen(window.innerWidth <= 640);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useLayoutEffect(() => {
    if (!isOpen || !smallScreen || !step.mobileLayoutTarget) {
      setDockHost(null);
      return;
    }
    const target = document.querySelector(step.mobileLayoutTarget);
    if (!target) { setDockHost(null); return; }
    // Keep instructions in document flow above the target, rather than covering
    // the controls the step asks the user to operate.
    const host = document.createElement('div');
    host.className = 'guided-tour-dock';
    target.before(host);
    setDockHost(host);
    return () => host.remove();
  }, [isOpen, smallScreen, step]);
  useLayoutEffect(() => {
    if (!isOpen || !cardRef.current) return;
    if (!focusBeforeTour.current) focusBeforeTour.current = document.activeElement;
    return lockTourInteraction(cardRef.current, step.interactionTargets || [], {
      restoreFocus: false, spotlightSelector: step.target,
      layerSelectors: step.interactionLayers || [],
    });
  }, [isOpen, step, dockHost]);
  useLayoutEffect(() => {
    if (!isOpen) return;
    return () => {
      // Restore the original trigger after releasing the last step's interaction lock.
      const previousFocus = focusBeforeTour.current;
      focusBeforeTour.current = null;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return void 0;
    setStepIndex(0);
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return void 0;
    const target = document.querySelector(steps[stepIndex].target);
    if (!target) return void 0;
    const hadPositionClass = target.classList.contains('guided-tour-positioned');
    const position = window.getComputedStyle(target).position;
    if (!position || position === 'static') target.classList.add('guided-tour-positioned');
    target.classList.add('guided-tour-spotlight');
    (dockHost || target).scrollIntoView({ behavior: 'smooth', block: dockHost ? 'start' : 'center' });
    return () => {
      target.classList.remove('guided-tour-spotlight');
      if (!hadPositionClass) target.classList.remove('guided-tour-positioned');
    };
  }, [isOpen, stepIndex, steps, dockHost]);
  useEffect(() => {
    if (!isOpen) return void 0;
    function handleKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      // Arrow keys belong to inputs, maps and other explicitly enabled controls.
      if (!cardRef.current?.contains(event.target)) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (!step.requiresSelection || canContinue) {
          setStepIndex((index) => Math.min(index + 1, steps.length - 1));
        }
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStepIndex((index) => Math.max(index - 1, 0));
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, steps.length, step.requiresSelection, canContinue]);
  if (!isOpen) return null;
  const isLastStep = stepIndex === steps.length - 1;
  const card = React.createElement(
      'section',
      {
        className: 'guided-tour-card',
        ref: cardRef,
        tabIndex: -1,
        role: 'dialog',
        'aria-modal': step.interactionTargets?.length ? undefined : 'true',
        'aria-labelledby': 'guided-tour-title',
        'aria-describedby': 'guided-tour-description',
      },
      React.createElement(
        'div',
        { className: 'guided-tour-card-top' },
        React.createElement(
          'span',
          { className: 'guided-tour-progress' },
          title,
          ' \xB7 ',
          stepIndex + 1,
          ' of ',
          steps.length,
        ),
        React.createElement(
          'button',
          {
            className: 'guided-tour-close',
            type: 'button',
            onClick: onClose,
            'aria-label': 'Close tour',
          },
          '\xD7',
        ),
      ),
      React.createElement('h2', { id: 'guided-tour-title' }, step.title),
      React.createElement('p', { id: 'guided-tour-description' }, step.description),
      React.createElement('p', { className: 'guided-tour-interaction-note' },
        step.interactionTargets?.length
          ? 'Try the controls described above. Other page buttons are locked during this step.'
          : `Read this step, then select ${isLastStep ? 'Finish tour' : 'Next'}. Page buttons are locked during this step.`),
      React.createElement(
        'div',
        { className: 'guided-tour-actions' },
        React.createElement(
          'button',
          { className: 'guided-tour-skip', type: 'button', onClick: onClose },
          'Skip tour',
        ),
        React.createElement(
          'div',
          { className: 'guided-tour-navigation' },
          stepIndex > 0 &&
            React.createElement(
              'button',
              {
                className: 'guided-tour-secondary',
                type: 'button',
                onClick: () => setStepIndex((index) => index - 1),
              },
              'Back',
            ),
          React.createElement(
            'button',
            {
              className: 'guided-tour-next',
              type: 'button',
              disabled: step.requiresSelection && !canContinue,
              onClick: () => (isLastStep ? onClose() : setStepIndex((index) => index + 1)),
            },
            isLastStep ? 'Finish tour' : 'Next',
          ),
        ),
      ),
  );
  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'guided-tour-backdrop', 'aria-hidden': 'true' }),
    dockHost ? createPortal(card, dockHost) : card);
}
export { GuidedTour as default };
