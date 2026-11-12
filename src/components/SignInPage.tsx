import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react';
import { useHabits } from '../context/HabitContext';
import { getReadableAuthError } from '../utils/authErrors';
import alpineLandscape from '../assets/images/alpine_meadow_sky_1794511898838.jpg';
import './sign-in.css';

type SignInPageProps = {
  onContinueLocal: () => void;
};

type AuthMode = 'signin' | 'signup';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function TrainPanorama() {
  return (
    <div className="train-panorama" aria-hidden="true">
      <div className="sky-fallback" />
      <img
        src={alpineLandscape}
        alt=""
        className="panorama-img"
        referrerPolicy="no-referrer"
      />
      <div className="panorama-atmosphere" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function SignInPage({ onContinueLocal }: SignInPageProps) {
  const { signIn, authNotice } = useHabits();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [demoNotice, setDemoNotice] = useState('');
  const [authError, setAuthError] = useState('');

  const emailId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const validateEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter your email address to continue.';
    if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address (for example, name@domain.com).';
    return '';
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setDemoNotice('');
    setAuthError('');
    setEmailError('');
    setTouched(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setDemoNotice('');
    setAuthError('');
    if (touched) setEmailError(validateEmail(value));
  };

  const handleEmailBlur = () => {
    setTouched(true);
    if (email.trim()) setEmailError(validateEmail(email));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    setAuthError('');
    setDemoNotice('');
    const validationMessage = validateEmail(email);
    if (validationMessage) {
      setEmailError(validationMessage);
      inputRef.current?.focus();
      return;
    }

    setEmailError('');
    setEmailBusy(true);
    window.setTimeout(() => {
      setEmailBusy(false);
      const trimmed = email.trim();
      setDemoNotice(
        mode === 'signup'
          ? `Demonstration only: email account creation for ${trimmed} is not connected here. Use Continue with Google or enter the local workspace.`
          : `Demonstration only: email sign-in for ${trimmed} is not connected here. Use Continue with Google or enter the local workspace.`
      );
    }, 320);
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setDemoNotice('');
    setGoogleBusy(true);
    try {
      await signIn();
    } catch (error) {
      setAuthError(getReadableAuthError(error));
    } finally {
      setGoogleBusy(false);
    }
  };

  const isBusy = emailBusy || googleBusy;

  return (
    <div className="train-auth-shell">
      <header className="carriage-topbar">
        <a
          href="#top"
          className="carriage-brand"
          onClick={e => {
            e.preventDefault();
            switchMode('signin');
          }}
        >
          <img className="carriage-brand-mark" src="/inpursuit-mark.svg" alt="" />
          <span className="carriage-brand-name">InPursuit</span>
        </a>

        <button
          type="button"
          className="carriage-top-link"
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
        </button>
      </header>

      <main className="carriage-stage">
        <div className="carriage-windows">
          <TrainPanorama />

          {/* Left partial side window */}
          <div className="train-window side-window side-left" aria-hidden="true">
            <div className="window-glass-sheen" />
            <div className="window-rubber-seal" />
            <div className="window-bezel" />
          </div>

          <div className="carriage-pillar pillar-left" aria-hidden="true" />

          {/* Central primary window */}
          <section className="train-window main-window" aria-labelledby="signin-heading">
            <div className="window-scrim" aria-hidden="true" />
            <div className="window-glass-sheen" aria-hidden="true" />
            <div className="window-rubber-seal" aria-hidden="true" />
            <div className="window-bezel" aria-hidden="true" />

            <div className="signin-frame-content">
              <div className="signin-badge">Good evening</div>

              <h1 id="signin-heading" className="signin-heading">
                {mode === 'signin' ? 'Welcome back.' : 'Create your account.'}
              </h1>

              <p className="signin-subtitle">
                {mode === 'signin'
                  ? 'Pick up where you left off. Your three priorities are waiting.'
                  : 'Set up your focused space for goals, habits, and daily priorities.'}
              </p>

              <form className="signin-form" noValidate onSubmit={handleSubmit}>
                <div className="signin-field">
                  <label htmlFor={emailId} className="signin-label">
                    Email address
                  </label>
                  <input
                    ref={inputRef}
                    id={emailId}
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    disabled={isBusy}
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? errorId : undefined}
                    className={`signin-input${emailError ? ' has-error' : ''}`}
                    onChange={e => handleEmailChange(e.target.value)}
                    onBlur={handleEmailBlur}
                  />
                  {emailError && (
                    <p id={errorId} className="signin-field-error" role="alert">
                      <AlertCircle size={14} aria-hidden="true" />
                      <span>{emailError}</span>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="signin-btn-primary"
                  disabled={isBusy}
                >
                  {emailBusy ? (
                    <>
                      <LoaderCircle size={16} className="signin-spin" aria-hidden="true" />
                      <span>Checking…</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight size={16} className="signin-arrow" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              {demoNotice && (
                <div className="signin-notice" role="status">
                  <p>{demoNotice}</p>
                  <button type="button" className="signin-notice-link" onClick={onContinueLocal}>
                    Open local workspace
                  </button>
                </div>
              )}

              {(authError || authNotice) && (
                <div className="signin-auth-error" role="alert">
                  <AlertCircle size={15} aria-hidden="true" />
                  <span>{authError || authNotice}</span>
                </div>
              )}

              <div className="signin-divider" role="separator" aria-label="or">
                <span>or</span>
              </div>

              <button
                type="button"
                className="signin-btn-google"
                disabled={isBusy}
                onClick={handleGoogleSignIn}
              >
                {googleBusy ? (
                  <>
                    <LoaderCircle size={16} className="signin-spin" aria-hidden="true" />
                    <span>Connecting to Google…</span>
                  </>
                ) : (
                  <>
                    <GoogleMark />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <p className="signin-footer">
                {mode === 'signin' ? (
                  <>
                    New here?{' '}
                    <button
                      type="button"
                      className="signin-footer-link"
                      onClick={() => switchMode('signup')}
                    >
                      Create an account.
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      className="signin-footer-link"
                      onClick={() => switchMode('signin')}
                    >
                      Sign in.
                    </button>
                  </>
                )}
              </p>

              <div className="signin-local-wrap">
                <button
                  type="button"
                  className="signin-local-btn"
                  onClick={onContinueLocal}
                >
                  Continue locally on this device
                </button>
              </div>
            </div>
          </section>

          <div className="carriage-pillar pillar-right" aria-hidden="true" />

          {/* Right partial side window */}
          <div className="train-window side-window side-right" aria-hidden="true">
            <div className="window-glass-sheen" />
            <div className="window-rubber-seal" />
            <div className="window-bezel" />
          </div>
        </div>

        {/* Lower carriage metallic sill rail and upholstered corner seats */}
        <div className="carriage-sill" aria-hidden="true" />
        <div className="carriage-lower-panel" aria-hidden="true" />
        <div className="carriage-seat carriage-seat-left" aria-hidden="true" />
        <div className="carriage-seat carriage-seat-right" aria-hidden="true" />
      </main>
    </div>
  );
}
