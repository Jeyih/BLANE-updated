import React from 'react';
import PasswordInput from './PasswordInput';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { REDIRECT_AFTER_LOGIN, REDIRECT_AFTER_REGISTER } from '../lib/supabase';
function AuthModal({ open, tab, onClose, onSwitchTab }) {
  const { login, register, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    (dialog?.querySelector('input') || dialog)?.focus();
    function handleKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const controls = [
        ...dialog.querySelectorAll(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
        ),
      ];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [open]);
  if (!open) return null;
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError('Please fill in all fields.');
      return;
    }
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate(REDIRECT_AFTER_LOGIN);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setRegError('');
    if (!regName || !regEmail || !regPassword || !regConfirm) {
      setRegError('Please fill in all fields.');
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters.');
      return;
    }
    setRegLoading(true);
    try {
      const data = await register(regName, regEmail, regPassword);
      if (data.session) {
        navigate(REDIRECT_AFTER_REGISTER);
      } else {
        setRegSuccess(true);
      }
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }
  async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (forgotLoading) return;
    const email = loginEmail.trim();
    if (!email) {
      setForgotError('Please enter your email address.');
      return;
    }
    setForgotLoading(true);
    try {
      await resetPassword(email);
      setLoginEmail(email);
      setForgotSuccess(
        `A password reset link has been sent to ${email}. Check your inbox and follow the instructions.`,
      );
    } catch (err) {
      setForgotError(err.message || 'Unable to send a password reset email.');
    } finally {
      setForgotLoading(false);
    }
  }
  return React.createElement(
    'div',
    {
      className: 'modal-overlay active',
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
    },
    React.createElement(
      'div',
      {
        className: 'modal',
        ref: dialogRef,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': tab === 'register' ? 'Create a BLANE account' : 'Sign in to BLANE',
        tabIndex: -1,
      },
      React.createElement(
        'button',
        { className: 'modal-close', 'aria-label': 'Close modal', onClick: onClose },
        '\u2715',
      ),
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
      React.createElement(
        'div',
        { className: 'modal-tabs' },
        React.createElement(
          'button',
          {
            className: 'modal-tab' + (tab === 'login' ? ' active' : ''),
            onClick: () => onSwitchTab('login'),
          },
          'Sign in',
        ),
        React.createElement(
          'button',
          {
            className: 'modal-tab' + (tab === 'register' ? ' active' : ''),
            onClick: () => onSwitchTab('register'),
          },
          'Register',
        ),
      ),
      tab === 'login' &&
        React.createElement(
          'form',
          { onSubmit: handleLoginSubmit, noValidate: true },
          loginError &&
            React.createElement(
              'p',
              { className: 'form-error', style: { display: 'block' } },
              loginError,
            ),
          forgotSuccess && React.createElement('p', { className: 'form-success' }, forgotSuccess),
          forgotError &&
            React.createElement(
              'p',
              { className: 'form-error', style: { display: 'block' } },
              forgotError,
            ),
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement(
              'label',
              { className: 'form-label', htmlFor: 'login-email' },
              'Email address',
            ),
            React.createElement('input', {
              className: 'form-input',
              type: 'email',
              id: 'login-email',
              placeholder: 'you@example.com',
              autoComplete: 'email',
              value: loginEmail,
              onChange: (e) => {
                setLoginEmail(e.target.value);
                if (forgotError) setForgotError('');
                if (forgotSuccess) setForgotSuccess('');
              },
            }),
          ),
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement(
              'label',
              { className: 'form-label', htmlFor: 'login-password' },
              'Password',
            ),
            React.createElement(PasswordInput, {
              className: 'form-input',
              id: 'login-password',
              placeholder: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022',
              autoComplete: 'current-password',
              value: loginPassword,
              onChange: (e) => setLoginPassword(e.target.value),
            }),
          ),
          React.createElement(
            'div',
            { className: 'form-forgot' },
            React.createElement(
              'button',
              { type: 'button', disabled: forgotLoading, onClick: handleForgotPasswordSubmit },
              forgotLoading ? 'Sending\u2026' : 'Forgot password?',
            ),
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'btn btn-primary btn-lg form-submit',
              disabled: loginLoading,
            },
            loginLoading ? 'Please wait\u2026' : 'Sign in',
          ),
          React.createElement(
            'p',
            { className: 'form-terms' },
            "Don't have an account?",
            ' ',
            React.createElement(
              'a',
              {
                href: '#',
                onClick: (e) => {
                  e.preventDefault();
                  onSwitchTab('register');
                },
              },
              'Register here',
            ),
          ),
        ),
      tab === 'register' &&
        !regSuccess &&
        React.createElement(
          'form',
          { onSubmit: handleRegisterSubmit, noValidate: true },
          regError &&
            React.createElement(
              'p',
              { className: 'form-error', style: { display: 'block' } },
              regError,
            ),
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement(
              'label',
              { className: 'form-label', htmlFor: 'reg-name' },
              'Full name',
            ),
            React.createElement('input', {
              className: 'form-input',
              type: 'text',
              id: 'reg-name',
              placeholder: 'Juan dela Cruz',
              autoComplete: 'name',
              value: regName,
              onChange: (e) => setRegName(e.target.value),
            }),
          ),
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement(
              'label',
              { className: 'form-label', htmlFor: 'reg-email' },
              'Email address',
            ),
            React.createElement('input', {
              className: 'form-input',
              type: 'email',
              id: 'reg-email',
              placeholder: 'you@example.com',
              autoComplete: 'email',
              value: regEmail,
              onChange: (e) => setRegEmail(e.target.value),
            }),
          ),
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement(
              'label',
              { className: 'form-label', htmlFor: 'reg-password' },
              'Password',
            ),
            React.createElement(PasswordInput, {
              className: 'form-input',
              id: 'reg-password',
              placeholder: 'Create a password',
              autoComplete: 'new-password',
              value: regPassword,
              onChange: (e) => setRegPassword(e.target.value),
            }),
          ),
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement(
              'label',
              { className: 'form-label', htmlFor: 'reg-confirm' },
              'Confirm password',
            ),
            React.createElement(PasswordInput, {
              className: 'form-input',
              id: 'reg-confirm',
              placeholder: 'Repeat password',
              autoComplete: 'new-password',
              value: regConfirm,
              onChange: (e) => setRegConfirm(e.target.value),
            }),
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'btn btn-primary btn-lg form-submit',
              disabled: regLoading,
            },
            regLoading ? 'Please wait\u2026' : 'Create account',
          ),
          React.createElement(
            'p',
            { className: 'form-terms' },
            'Review the ',
            React.createElement(
              'a',
              { href: '#your-data', onClick: onClose },
              'data and estimate information',
            ),
            ' before creating your account.',
          ),
        ),
      tab === 'register' &&
        regSuccess &&
        React.createElement(
          'div',
          { className: 'auth-success' },
          React.createElement('div', { className: 'auth-success-icon' }, '\u2709\uFE0F'),
          React.createElement('h3', null, 'Check your email'),
          React.createElement(
            'p',
            null,
            'We sent a confirmation link to ',
            React.createElement('strong', null, regEmail),
            '.',
            React.createElement('br', null),
            'Click it to activate your account, then sign in.',
          ),
          React.createElement(
            'button',
            {
              className: 'btn btn-outline',
              onClick: () => {
                setRegSuccess(false);
                onSwitchTab('login');
              },
            },
            'Back to Sign in',
          ),
        ),
    ),
  );
}
export { AuthModal as default };
