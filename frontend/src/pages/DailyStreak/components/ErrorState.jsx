import { Link } from 'react-router-dom';
import { RefreshCw, WifiOff, LogIn } from 'lucide-react';
import Logo from '../../../components/common/Logo';
import styles from './ErrorState.module.css';

export default function ErrorState({ error, onRetry }) {
  const isAuth = error?.status === 401;
  const isNetwork = error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT';
  return (
    <div className={styles.screen}>
      <div className={styles.card} role="alert">
        <Logo size={56} />
        <div className={styles.icon}>{isNetwork ? <WifiOff size={22} /> : <RefreshCw size={22} />}</div>
        <h1 className={styles.title}>{isAuth ? 'Please log in to continue.' : 'We couldn’t load your streak'}</h1>
        <p className={styles.text}>{error?.message || 'Unable to load your streak. Please try again.'}</p>
        {isAuth ? (
          <Link to="/login" className={styles.button}>
            <LogIn size={16} /> Log in
          </Link>
        ) : (
          <button type="button" className={styles.button} onClick={onRetry}>
            <RefreshCw size={16} /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
