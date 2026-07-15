/* ============================================================
   BLANE — Auth Modal
   Replaces: the #modal-overlay markup in index.html, plus the
   modal open/close/tab-switch logic from js/main.js and the
   handleLoginSubmit/handleRegisterSubmit logic from js/auth.js.

   Old vanilla flow: click [data-modal="login"] anywhere on the
   page -> openModal('login') -> DOM manipulation.

   New React flow: Landing.jsx holds `modalOpen` + `modalTab`
   state and passes them down as props; any button just calls
   the passed-in `onOpen('login')` / `onOpen('register')`.
   ============================================================ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { REDIRECT_AFTER_LOGIN, REDIRECT_AFTER_REGISTER } from '../lib/supabase';

export default function AuthModal({ open, tab, onClose, onSwitchTab }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError]       = useState('');
  const [loginLoading, setLoginLoading]   = useState(false);

  const [regName, setRegName]             = useState('');
  const [regEmail, setRegEmail]           = useState('');
  const [regPassword, setRegPassword]     = useState('');
  const [regConfirm, setRegConfirm]       = useState('');
  const [regError, setRegError]           = useState('');
  const [regLoading, setRegLoading]       = useState(false);
  const [regSuccess, setRegSuccess]       = useState(false);

  if (!open) return null;

  /* ---- LOGIN — mirrors old handleLoginSubmit() ---- */
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

  /* ---- REGISTER — mirrors old handleRegisterSubmit() ---- */
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
        /* Email confirmation OFF — go straight to onboarding */
        navigate(REDIRECT_AFTER_REGISTER);
      } else {
        /* Email confirmation ON — show the "check your email" state */
        setRegSuccess(true);
      }
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="modal-close" aria-label="Close modal" onClick={onClose}>✕</button>

        <div className="modal-logo">
          <span className="logo">
            <span className="logo-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z"/>
              </svg>
            </span>
            <span className="logo-text"><span>BL</span>ANE</span>
          </span>
        </div>

        <div className="modal-tabs">
          <button className={'modal-tab' + (tab === 'login' ? ' active' : '')} onClick={() => onSwitchTab('login')}>Sign in</button>
          <button className={'modal-tab' + (tab === 'register' ? ' active' : '')} onClick={() => onSwitchTab('register')}>Register</button>
        </div>

        {tab === 'login' && (
          <form onSubmit={handleLoginSubmit} noValidate>
            {loginError && <p className="form-error" style={{ display: 'block' }}>{loginError}</p>}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email address</label>
              <input
                className="form-input" type="email" id="login-email" placeholder="you@example.com"
                value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                className="form-input" type="password" id="login-password" placeholder="••••••••"
                value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <div className="form-forgot"><a href="#">Forgot password?</a></div>
            <button type="submit" className="btn btn-primary btn-lg form-submit" disabled={loginLoading}>
              {loginLoading ? 'Please wait…' : 'Sign in'}
            </button>
            <p className="form-terms">
              Don't have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); onSwitchTab('register'); }}>Register here</a>
            </p>
          </form>
        )}

        {tab === 'register' && !regSuccess && (
          <form onSubmit={handleRegisterSubmit} noValidate>
            {regError && <p className="form-error" style={{ display: 'block' }}>{regError}</p>}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">Full name</label>
              <input
                className="form-input" type="text" id="reg-name" placeholder="Juan dela Cruz"
                value={regName} onChange={(e) => setRegName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email address</label>
              <input
                className="form-input" type="email" id="reg-email" placeholder="you@example.com"
                value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input
                className="form-input" type="password" id="reg-password" placeholder="Create a password"
                value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Confirm password</label>
              <input
                className="form-input" type="password" id="reg-confirm" placeholder="Repeat password"
                value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg form-submit" disabled={regLoading}>
              {regLoading ? 'Please wait…' : 'Create account'}
            </button>
            <p className="form-terms">
              By registering you agree to our{' '}
              <a href="#">Terms of Use</a> and <a href="#">Privacy Policy</a>.
            </p>
          </form>
        )}

        {tab === 'register' && regSuccess && (
          <div className="auth-success">
            <div className="auth-success-icon">✉️</div>
            <h3>Check your email</h3>
            <p>
              We sent a confirmation link to <strong>{regEmail}</strong>.<br />
              Click it to activate your account, then sign in.
            </p>
            <button className="btn btn-outline" onClick={() => { setRegSuccess(false); onSwitchTab('login'); }}>
              Back to Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
