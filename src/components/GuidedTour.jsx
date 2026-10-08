import { useEffect, useState } from 'react';
import '../styles/guided-tour.css';

export default function GuidedTour({ isOpen, onClose, title, steps, canContinue = true }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!isOpen) return undefined;

    setStepIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const target = document.querySelector(steps[stepIndex].target);
    if (!target) return undefined;

    target.classList.add('guided-tour-spotlight');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => target.classList.remove('guided-tour-spotlight');
  }, [isOpen, stepIndex, steps]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') {
        if (!step.requiresSelection || canContinue) {
          setStepIndex((index) => Math.min(index + 1, steps.length - 1));
        }
      }
      if (event.key === 'ArrowLeft') {
        setStepIndex((index) => Math.max(index - 1, 0));
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, steps.length, step.requiresSelection, canContinue]);

  if (!isOpen) return null;

  const isLastStep = stepIndex === steps.length - 1;

  return (
    <>
      <div className="guided-tour-backdrop" aria-hidden="true" />
      <section
        className="guided-tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
      >
        <div className="guided-tour-card-top">
          <span className="guided-tour-progress">{title} · {stepIndex + 1} of {steps.length}</span>
          <button className="guided-tour-close" type="button" onClick={onClose} aria-label="Close tour">
            ×
          </button>
        </div>
        <h2 id="guided-tour-title">{step.title}</h2>
        <p id="guided-tour-description">{step.description}</p>
        <div className="guided-tour-actions">
          <button className="guided-tour-skip" type="button" onClick={onClose}>
            Skip tour
          </button>
          <div className="guided-tour-navigation">
            {stepIndex > 0 && (
              <button
                className="guided-tour-secondary"
                type="button"
                onClick={() => setStepIndex((index) => index - 1)}
              >
                Back
              </button>
            )}
            <button
              className="guided-tour-next"
              type="button"
              disabled={step.requiresSelection && !canContinue}
              onClick={() => (isLastStep ? onClose() : setStepIndex((index) => index + 1))}
            >
              {isLastStep ? 'Finish tour' : 'Next'}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
