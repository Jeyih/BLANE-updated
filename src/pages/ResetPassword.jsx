import React from 'react';
import PasswordInput from '../components/PasswordInput';
import { useEffect, useState } from 'react';
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
  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setReady(Boolean(session));
    }
    void checkSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setReady(Boolean(session));
      }
    });
    return () => {
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
    try {
      await updatePassword(newPassword);
      setSuccess(
        'Your password has been updated successfully. Redirecting you back to sign in\u2026',
      );
      setTimeout(() => navigate('/'), 1800);
    } catch (err) {
      setError(err.message || 'Unable to update your password. Please request a new reset link.');
    } finally {
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
      !ready
        ? React.createElement('p', null, 'Checking your secure reset link\u2026')
        : React.createElement(
            'form',
            { onSubmit: handlePasswordReset, noValidate: true },
            error &&
              React.createElement(
                'p',
                { className: 'form-error', style: { display: 'block' } },
                error,
              ),
            success && React.createElement('p', { className: 'form-success' }, success),
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
