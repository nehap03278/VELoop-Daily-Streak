import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ChevronRight, Clock, Crown, Flame, Gem, Gift, Lock, LogOut, Receipt, RotateCcw, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStreak } from '../../services/streakApi';
import { getWallet, getTransactions, devTimeTravel, devResetMyStreak } from '../../services/walletApi';
import Logo from '../../components/common/Logo';
import flame from '../../assets/rewards/flame.webp';
import heroCrown from '../../assets/rewards/hero-crown.webp';
import { rewardImage } from '../../utils/rewardAssets';
import { formatDateTime, formatNumber, streakTitle } from '../../utils/format';
import styles from './HomePage.module.css';

const SHOW_DEV_TOOLS = import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';

/** Rewards hub: wallet balances, streak entry point and the reward ledger - all loaded from the backend. */
export default function HomePage() {
  const { user, logout } = useAuth();
  const [state, setState] = useState({ status: 'loading', wallet: null, streak: null, rewards: [], ultimate: null, transactions: [], error: null });
  const [devMessage, setDevMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [wallet, page, transactions] = await Promise.all([getWallet(), getStreak(), getTransactions({ limit: 6 })]);
      setState({
        status: 'ready',
        wallet,
        streak: page.data.streak,
        rewards: page.data.rewards,
        ultimate: page.data.ultimateReward,
        transactions: transactions.items,
        error: null,
      });
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

  const { wallet, streak, rewards, ultimate, transactions } = state;
  const claimed = rewards.filter((card) => card.state === 'CLAIMED').length;

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
          <div className={styles.headerActions}>
            <Link to="/profile" className={styles.profileLink} aria-label="View profile">
              <User size={16} /> <span className="d-none d-sm-inline">Profile</span>
            </Link>
            <button type="button" className={styles.logout} onClick={logout}>
              <LogOut size={16} /> <span className="d-none d-sm-inline">Log out</span>
            </button>
          </div>
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
              <div className={styles.streakTop}>
                <img src={flame} alt="" className={styles.flame} />
                <div className={styles.streakBody}>
                  <p className={styles.cardLabel}>Daily Streak</p>
                  <strong className={state.status === 'loading' ? styles.shimmer : ''}>{streak ? streakTitle(streak.currentStreak) : ''}</strong>
                  <span>{streak ? (streak.claimable ? `Day ${streak.currentDay} reward is ready!` : `Day ${streak.currentDay} unlocks soon`) : ''}</span>
                </div>
                <span className={`${styles.cta} ${streak?.claimable ? styles.ctaReady : ''}`}>
                  {streak?.claimable ? 'Claim' : 'Open'} <ChevronRight size={16} />
                </span>
              </div>
              {rewards.length > 0 && (
                <div className={styles.track} aria-label={`${claimed} of ${rewards.length} days claimed`}>
                  {rewards.map((card) => (
                    <span
                      key={card.day}
                      className={[
                        styles.seg,
                        card.state === 'CLAIMED' ? styles.segDone : '',
                        card.state === 'TODAY' ? styles.segToday : '',
                        card.reward.isUltimate ? styles.segGoal : '',
                      ].join(' ')}
                    />
                  ))}
                </div>
              )}
            </Link>
          </div>
        </div>

        {rewards.length > 0 && (
          <section className={styles.week} aria-labelledby="week-title">
            <div className={styles.sectionHead}>
              <h2 id="week-title" className={styles.sectionTitle}>
                This week’s rewards
              </h2>
              <Link to="/daily-streak" className={styles.seeAll}>
                View journey <ChevronRight size={14} />
              </Link>
            </div>
            <ol className={styles.tiles}>
              {rewards.map((card) => (
                <li
                  key={card.day}
                  className={[
                    styles.tile,
                    card.state === 'CLAIMED' ? styles.tileDone : '',
                    card.state === 'TODAY' ? styles.tileToday : '',
                    card.isNext ? styles.tileNext : '',
                    card.reward.isUltimate ? styles.tileGoal : '',
                  ].join(' ')}
                >
                  <span className={styles.tileDay}>Day {card.day}</span>
                  <img src={rewardImage(card.reward.assetType)} alt="" className={styles.tileImg} loading="lazy" />
                  <strong className={styles.tileValue}>{card.reward.displayValue}</strong>
                  <span className={styles.tileState}>
                    {card.state === 'CLAIMED' ? 'Claimed' : card.state === 'TODAY' ? 'Ready!' : card.isNext ? 'Next' : <Lock size={11} />}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className={styles.lower}>
          <div className={styles.main}>
            <section className={styles.ledger}>
              <h2 className={styles.sectionTitle}>Recent transactions</h2>
              {state.status === 'ready' && transactions.length === 0 && (
                <div className={styles.empty}>
                  <Receipt size={26} />
                  <p>No rewards yet - claim Day 1 to see it here.</p>
                </div>
              )}
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

            <section className={styles.how}>
              <h2 className={styles.sectionTitle}>How it works</h2>
              <ol>
                <li>
                  <span className={styles.howIcon}>
                    <CalendarCheck size={16} />
                  </span>
                  <div>
                    <strong>Check in daily</strong>
                    <small>Open Daily Streak and claim once every day.</small>
                  </div>
                </li>
                <li>
                  <span className={styles.howIcon}>
                    <Flame size={16} />
                  </span>
                  <div>
                    <strong>Grow your streak</strong>
                    <small>Rewards get bigger each day you return.</small>
                  </div>
                </li>
                <li>
                  <span className={`${styles.howIcon} ${styles.howGold}`}>
                    <Gift size={16} />
                  </span>
                  <div>
                    <strong>Unlock the grand prize</strong>
                    <small>Reach Day 7 for the ultimate gift card.</small>
                  </div>
                </li>
              </ol>
            </section>
          </div>

          <aside className={styles.side}>
            {ultimate && (
              <Link to="/daily-streak" className={styles.prize}>
                <img src={heroCrown} alt="" className={styles.prizeCrown} />
                <span className={styles.prizeLabel}>
                  <Crown size={12} /> Grand prize · Day {ultimate.unlockDay}
                </span>
                <strong className={styles.prizeValue}>{ultimate.displayValue}</strong>
                <span className={styles.prizeSub}>{ultimate.subtitle}</span>
                <span className={styles.prizeBar}>
                  <span style={{ width: `${rewards.length ? (claimed / rewards.length) * 100 : 0}%` }} />
                </span>
                <span className={styles.prizeMeta}>
                  {ultimate.status === 'CLAIMED'
                    ? 'Claimed - nice work!'
                    : ultimate.status === 'AVAILABLE'
                      ? 'Unlocked - claim it today!'
                      : `${rewards.length - claimed} ${rewards.length - claimed === 1 ? 'day' : 'days'} to go`}
                </span>
              </Link>
            )}
          </aside>
        </div>

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
