import React from 'react';
import PasswordInput from '../components/PasswordInput';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import '../styles/landing.css';
function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState('');
  const errorRef = useRef(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const invalidCallback = query.has('error') || query.has('error_code') || fragment.has('error') || fragment.has('error_code');
    if (invalidCallback) {
      setLinkError('This reset link is invalid or expired. Request a new reset email.');
      setChecking(false);
      return;
    }
    async function checkSession() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;
        setReady(Boolean(session) && !sessionError);
        if (!session || sessionError) setLinkError('This reset link is invalid or expired. Request a new reset email.');
      } catch {
        if (active) setLinkError('Could not check your reset link. Check your connection and try again.');
      } finally {
        if (active) setChecking(false);
      }
    }
    void checkSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setReady(Boolean(session));
        if (session) setLinkError('');
        setChecking(false);
      }
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);
  async function handlePasswordReset(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    const confirmationTimer = setTimeout(() => {
      setError('Still waiting for server confirmation. Check your connection and avoid submitting again until this finishes.');
    }, 15000);
    try {
      await updatePassword(newPassword);
      setError('');
      setSuccess('Your password has been updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Unable to update your password. Please request a new reset link.');
    } finally {
      clearTimeout(confirmationTimer);
      setLoading(false);
    }
  }
  return React.createElement(
    'div',
    { className: 'reset-password-shell' },
    React.createElement(
      'div',
      { className: 'modal reset-password-card', role: 'dialog', 'aria-modal': 'true' },
      React.createElement(
        'div',
        { className: 'modal-logo' },
        React.createElement(
          'span',
          { className: 'logo' },
          React.createElement(
            'span',
            { className: 'logo-icon' },
            React.createElement(
              'svg',
              { viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
              React.createElement('path', {
                d: 'M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z',
              }),
            ),
          ),
          React.createElement(
            'span',
            { className: 'logo-text' },
            React.createElement('span', null, 'BL'),
            'ANE',
          ),
        ),
      ),
      React.createElement('h3', null, 'Reset your password'),
      success
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement('p', { className: 'form-success', role: 'status', style: { display: 'block' } }, success),
            React.createElement('button', { type: 'button', className: 'btn btn-primary btn-lg form-submit', onClick: () => navigate('/dashboard') }, 'Continue to BLANE'),
          )
        : checking
          ? React.createElement('p', { role: 'status' }, 'Checking your secure reset link\u2026')
          : !ready
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement('p', { className: 'form-error', role: 'alert', style: { display: 'block' } }, linkError || 'This reset link is invalid or expired. Request a new reset email.'),
                React.createElement('button', { type: 'button', className: 'btn btn-primary btn-lg form-submit', onClick: () => navigate('/') }, 'Back to BLANE'),
              )
            : React.createElement(
            'form',
            { onSubmit: handlePasswordReset, noValidate: true },
            error &&
              React.createElement(
                'p',
                { className: 'form-error', id: 'reset-password-error', ref: errorRef, role: 'alert', tabIndex: -1, style: { display: 'block' } },
                error,
              ),
            React.createElement(
              'div',
              { className: 'form-group' },
              React.createElement(
                'label',
                { className: 'form-label', htmlFor: 'reset-new-password' },
                'New password',
              ),
              React.createElement(PasswordInput, {
                className: 'form-input',
                id: 'reset-new-password',
                autoComplete: 'new-password',
                'aria-describedby': error ? 'reset-password-error' : undefined,
                placeholder: 'Enter a new password',
                value: newPassword,
                onChange: (e) => setNewPassword(e.target.value),
              }),
            ),
            React.createElement(
              'div',
              { className: 'form-group' },
              React.createElement(
                'label',
                { className: 'form-label', htmlFor: 'reset-confirm-password' },
                'Confirm password',
              ),
              React.createElement(PasswordInput, {
                className: 'form-input',
                id: 'reset-confirm-password',
                autoComplete: 'new-password',
                'aria-describedby': error ? 'reset-password-error' : undefined,
                placeholder: 'Repeat your new password',
                value: confirmPassword,
                onChange: (e) => setConfirmPassword(e.target.value),
              }),
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                className: 'btn btn-primary btn-lg form-submit',
                disabled: loading || !ready,
              },
              loading ? 'Please wait\u2026' : 'Update password',
            ),
          ),
    ),
  );
}
export { ResetPassword as default };
