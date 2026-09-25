import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserPlus, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/common/Logo';
import heroGift from '../../assets/rewards/hero-gift.webp';
import styles from './LoginPage.module.css';

const DEMO = { email: 'demo@veloop.in', password: 'Demo@1234' };

export default function LoginPage() {
  const { status, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const destination = location.state?.from || '/daily-streak';
  if (status === 'authenticated') return <Navigate to={destination} replace />;

  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'login') await login({ email: form.email, password: form.password });
      else await register(form);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Logo size={48} />
          <div>
            <p className={styles.brandName}>
              VELoop <span>Rewards</span>
            </p>
            <p className={styles.brandTag}>Check in daily. Earn bigger rewards.</p>
          </div>
        </div>
        <img src={heroGift} alt="" className={styles.art} />

        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? styles.tabActive : ''} onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? styles.tabActive : ''} onClick={() => setMode('register')}>
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <div className="mb-3">
              <label htmlFor="name" className={styles.label}>
                Name
              </label>
              <input id="name" className={`form-control ${styles.input}`} value={form.name} onChange={update('name')} autoComplete="name" required minLength={2} />
            </div>
          )}
          <div className="mb-3">
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input id="email" type="email" className={`form-control ${styles.input}`} value={form.email} onChange={update('email')} autoComplete="email" required />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-control ${styles.input}`}
                value={form.password}
                onChange={update('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              <button type="button" className={styles.eye} onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === 'register' && <p className={styles.hint}>At least 8 characters with a letter and a number.</p>}
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? <span className={styles.spinner} aria-hidden="true" /> : mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        {mode === 'login' && (
          <button type="button" className={styles.demo} onClick={() => setForm((previous) => ({ ...previous, ...DEMO }))}>
            <Sparkles size={15} /> Use demo account ({DEMO.email})
          </button>
        )}
      </div>
    </main>
  );
}
