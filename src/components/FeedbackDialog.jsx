import React from 'react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../styles/feedback-form.css';
const MAX_MESSAGE_LENGTH = 2e3;
const MIN_MESSAGE_LENGTH = 10;
function FeedbackDialog({ open, onClose }) {
  const location = useLocation();
  const [category, setCategory] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!open) return void 0;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, submitting]);
  function closeDialog() {
    if (submitting) return;
    setCategory('suggestion');
    setMessage('');
    setError('');
    setSubmitted(false);
    onClose();
  }
  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
      setError(`Please enter at least ${MIN_MESSAGE_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('feedback')
        .insert({ category, message: trimmedMessage, page_path: location.pathname });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (submitError) {
      console.error('Unable to save feedback:', submitError);
      setError(`Unable to save your feedback. ${submitError.message || 'Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  }
  if (!open) return null;
  return React.createElement(
    'div',
    {
      className: 'feedback-form-overlay',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) closeDialog();
      },
    },
    React.createElement(
      'section',
      {
        className: 'feedback-form-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'feedback-form-title',
      },
      React.createElement(
        'button',
        {
          className: 'feedback-form-close',
          type: 'button',
          'aria-label': 'Close feedback form',
          onClick: closeDialog,
          disabled: submitting,
        },
        '\xD7',
      ),
      submitted
        ? React.createElement(
            'div',
            { className: 'feedback-form-success', role: 'status' },
            React.createElement(
              'span',
              { className: 'feedback-form-success-icon', 'aria-hidden': 'true' },
              '\u2713',
            ),
            React.createElement(
              'h2',
              { id: 'feedback-form-title' },
              'Thank you for your feedback!',
            ),
            React.createElement(
              'p',
              null,
              'Your message has been saved. We appreciate you helping us improve BLANE.',
            ),
            React.createElement(
              'button',
              { className: 'feedback-form-submit', type: 'button', onClick: closeDialog },
              'Done',
            ),
          )
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'div',
              { className: 'feedback-form-heading' },
              React.createElement(
                'span',
                { className: 'feedback-form-icon', 'aria-hidden': 'true' },
                '\u2709',
              ),
              React.createElement(
                'div',
                null,
                React.createElement('h2', { id: 'feedback-form-title' }, 'Share your feedback'),
                React.createElement(
                  'p',
                  null,
                  'Tell us what\u2019s working or how we can improve.',
                ),
              ),
            ),
            React.createElement(
              'form',
              { onSubmit: handleSubmit },
              React.createElement(
                'label',
                { className: 'feedback-form-label', htmlFor: 'feedback-category' },
                'What is this about?',
              ),
              React.createElement(
                'select',
                {
                  id: 'feedback-category',
                  value: category,
                  onChange: (event) => setCategory(event.target.value),
                  disabled: submitting,
                },
                React.createElement('option', { value: 'suggestion' }, 'Suggestion'),
                React.createElement('option', { value: 'issue' }, 'Report an issue'),
                React.createElement('option', { value: 'other' }, 'Other'),
              ),
              React.createElement(
                'label',
                { className: 'feedback-form-label', htmlFor: 'feedback-message' },
                'Your message',
              ),
              React.createElement('textarea', {
                id: 'feedback-message',
                value: message,
                onChange: (event) => setMessage(event.target.value),
                placeholder: 'Share your thoughts with us...',
                minLength: MIN_MESSAGE_LENGTH,
                maxLength: MAX_MESSAGE_LENGTH,
                rows: 5,
                required: true,
                disabled: submitting,
              }),
              React.createElement(
                'div',
                { className: 'feedback-form-count', 'aria-live': 'polite' },
                message.length,
                '/',
                MAX_MESSAGE_LENGTH,
              ),
              error &&
                React.createElement(
                  'p',
                  { className: 'feedback-form-error', role: 'alert' },
                  error,
                ),
              React.createElement(
                'button',
                { className: 'feedback-form-submit', type: 'submit', disabled: submitting },
                submitting ? 'Sending\u2026' : 'Send feedback',
              ),
            ),
          ),
    ),
  );
}
export { FeedbackDialog as default };
