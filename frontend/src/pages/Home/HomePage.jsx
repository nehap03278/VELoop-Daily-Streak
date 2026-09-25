import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Gem, Gift, LogOut, Clock, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStatus } from '../../services/streakApi';
import { getWallet, getTransactions, devTimeTravel, devResetMyStreak } from '../../services/walletApi';
import Logo from '../../components/common/Logo';
import flame from '../../assets/rewards/flame.webp';
import { formatDateTime, formatNumber, streakTitle } from '../../utils/format';
import styles from './HomePage.module.css';

const SHOW_DEV_TOOLS = import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';

/** Rewards hub: wallet balances, streak entry point and the reward ledger - all loaded from the backend. */
export default function HomePage() {
  const { user, logout } = useAuth();
  const [state, setState] = useState({ status: 'loading', wallet: null, streak: null, transactions: [], error: null });
  const [devMessage, setDevMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [wallet, status, transactions] = await Promise.all([getWallet(), getStatus(), getTransactions({ limit: 8 })]);
      setState({ status: 'ready', wallet, streak: status.data.streak, transactions: transactions.items, error: null });
    } catch (error) {
      setState((previous) => ({ ...previous, status: 'error', error }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runDevAction(action, label) {
    setDevMessage('Working...');
    try {
      await action();
      setDevMessage(`${label} done. Open Daily Streak to see the backend result.`);
      load();
    } catch (error) {
      setDevMessage(error.status === 404 ? 'Dev tools are disabled on the backend (ENABLE_DEV_TOOLS=false).' : error.message);
    }
  }

  const { wallet, streak, transactions } = state;

  return (
    <main className={styles.page}>
      <div className={`container ${styles.container}`}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <Logo size={40} />
            <div>
              <p className={styles.hello}>Hi, {user?.name}</p>
              <p className={styles.brandName}>
                VELoop <span>Rewards</span>
              </p>
            </div>
          </div>
          <button type="button" className={styles.logout} onClick={logout}>
            <LogOut size={16} /> <span className="d-none d-sm-inline">Log out</span>
          </button>
        </header>

        {state.status === 'error' && (
          <p className={styles.error} role="alert">
            {state.error.message}{' '}
            <button type="button" onClick={load}>
              Retry
            </button>
          </p>
        )}

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <section className={styles.balanceCard}>
              <p className={styles.cardLabel}>Wallet</p>
              <div className={styles.balances}>
                <div>
                  <span className={styles.gem}>
                    <Gem size={18} />
                  </span>
                  <strong className={state.status === 'loading' ? styles.shimmer : ''}>{wallet ? formatNumber(wallet.balances.VES) : ''}</strong>
                  <small>VEs</small>
                </div>
                <div>
                  <span className={`${styles.gem} ${styles.goldGem}`}>
                    <Gift size={18} />
                  </span>
                  <strong className={state.status === 'loading' ? styles.shimmer : ''}>{wallet ? `₹${formatNumber(wallet.balances.INR)}` : ''}</strong>
                  <small>Gift cards</small>
                </div>
              </div>
            </section>
          </div>
          <div className="col-12 col-md-6">
            <Link to="/daily-streak" className={styles.streakCard}>
              <img src={flame} alt="" className={styles.flame} />
              <div className={styles.streakBody}>
                <p className={styles.cardLabel}>Daily Streak</p>
                <strong className={state.status === 'loading' ? styles.shimmer : ''}>{streak ? streakTitle(streak.currentStreak) : ''}</strong>
                <span>{streak ? (streak.claimable ? `Day ${streak.currentDay} reward is ready!` : `Day ${streak.currentDay} unlocks soon`) : ''}</span>
              </div>
              <ChevronRight size={22} />
            </Link>
          </div>
        </div>

        <section className={styles.ledger}>
          <h2 className={styles.sectionTitle}>Recent transactions</h2>
          {state.status === 'ready' && transactions.length === 0 && <p className={styles.empty}>No transactions yet.</p>}
          <ul className={styles.list}>
            {transactions.map((txn) => (
              <li key={txn.transactionId} className={styles.row}>
                <div>
                  <strong>{txn.description || txn.source}</strong>
                  <span>
                    {formatDateTime(txn.createdAt)} · {txn.referenceId}
                  </span>
                </div>
                <div className={styles.amount}>
                  <strong>
                    +{txn.currency === 'INR' ? '₹' : ''}
                    {formatNumber(txn.amount)} {txn.currency === 'VES' ? 'VEs' : ''}
                  </strong>
                  <span>
                    Balance {txn.currency === 'INR' ? '₹' : ''}
                    {formatNumber(txn.balanceAfter)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {SHOW_DEV_TOOLS && (
          <section className={styles.dev}>
            <h2 className={styles.sectionTitle}>QA tools (development only)</h2>
            <p className={styles.devText}>
              Simulates time passing for <b>your own</b> account by moving your stored claim timestamps back. Server time is never changed.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <button type="button" onClick={() => runDevAction(() => devTimeTravel(24), '+24h')}>
                <Clock size={15} /> +24 hours
              </button>
              <button type="button" onClick={() => runDevAction(() => devTimeTravel(49), '+49h')}>
                <Clock size={15} /> +49 hours (miss a day)
              </button>
              <button type="button" onClick={() => runDevAction(devResetMyStreak, 'Reset')}>
                <RotateCcw size={15} /> Reset my streak
              </button>
            </div>
            {devMessage && <p className={styles.devText}>{devMessage}</p>}
          </section>
        )}
      </div>
    </main>
  );
}
