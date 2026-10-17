import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ChevronRight, Clock, Coins, Flame, Gem, Gift, LogOut, Nfc, Receipt, RotateCcw, Sparkles, Trophy, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStatus } from '../../services/streakApi';
import { getWallet, getTransactions, devTimeTravel, devResetMyStreak } from '../../services/walletApi';
import { useCountdown } from '../../hooks/useCountdown';
import { createServerClock, formatDuration } from '../../utils/serverClock';
import Logo from '../../components/common/Logo';
import { formatDate, formatNumber } from '../../utils/format';
import styles from './HomePage.module.css';

const SHOW_DEV_TOOLS = import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';
const PAGE_SIZE = 8;
const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'VES', label: 'VEs' },
  { id: 'INR', label: 'Gift cards' },
];

function dayLabel(iso) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(iso);
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function money(currency, amount) {
  return currency === 'INR' ? `₹${formatNumber(amount)}` : `${formatNumber(amount)} VEs`;
}

/** Rewards hub: wallet, streak shortcut and the reward activity feed - all loaded from the backend. */
export default function HomePage() {
  const { user, logout } = useAuth();
  const [state, setState] = useState({ status: 'loading', wallet: null, streak: null, serverNow: null, error: null });
  const [feed, setFeed] = useState({ items: [], page: 0, total: 0, loadingMore: false });
  const [filter, setFilter] = useState('ALL');
  const [devMessage, setDevMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [wallet, status, transactions] = await Promise.all([getWallet(), getStatus(), getTransactions({ page: 1, limit: PAGE_SIZE })]);
      setState({
        status: 'ready',
        wallet,
        streak: status.data.streak,
        serverNow: createServerClock(status.data.serverTime, status.timing),
        error: null,
      });
      setFeed({ items: transactions.items, page: 1, total: transactions.total, loadingMore: false });
    } catch (error) {
      setState((previous) => ({ ...previous, status: 'error', error }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    setFeed((previous) => ({ ...previous, loadingMore: true }));
    try {
      const next = await getTransactions({ page: feed.page + 1, limit: PAGE_SIZE });
      setFeed((previous) => ({ items: [...previous.items, ...next.items], page: previous.page + 1, total: next.total, loadingMore: false }));
    } catch {
      setFeed((previous) => ({ ...previous, loadingMore: false }));
    }
  }

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

  const { wallet, streak, serverNow } = state;
  const loading = state.status === 'loading';
  // Display-only countdown to the backend's nextClaimAt; when it hits zero we just reload from the backend.
  const countdownMs = useCountdown(streak && !streak.claimable ? streak.nextClaimAt : null, serverNow, load);

  const groups = useMemo(() => {
    const visible = filter === 'ALL' ? feed.items : feed.items.filter((txn) => txn.currency === filter);
    const map = new Map();
    visible.forEach((txn) => {
      const key = dayLabel(txn.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(txn);
    });
    return [...map.entries()];
  }, [feed.items, filter]);

  const lastReward = feed.items[0];

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
            <Link to="/profile" className={styles.iconButton} aria-label="View profile">
              <User size={16} /> <span className="d-none d-sm-inline">Profile</span>
            </Link>
            <button type="button" className={styles.iconButton} onClick={logout}>
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

        <div className={styles.top}>
          {/* Wallet, styled like a payment card */}
          <section className={styles.walletCard} aria-label="Wallet">
            <div className={styles.walletHead}>
              <span className={styles.walletTitle}>VELoop Wallet</span>
              <Logo size={30} />
            </div>
            <div className={styles.balances}>
              <div>
                <span className={styles.balanceLabel}>
                  <Gem size={14} /> VEs balance
                </span>
                <strong className={loading ? styles.shimmer : ''}>{wallet ? formatNumber(wallet.balances.VES) : ''}</strong>
              </div>
              <div>
                <span className={styles.balanceLabel}>
                  <Gift size={14} /> Gift cards
                </span>
                <strong className={loading ? styles.shimmer : ''}>{wallet ? `₹${formatNumber(wallet.balances.INR)}` : ''}</strong>
              </div>
            </div>
            <div className={styles.walletFoot}>
              <span>{user?.name}</span>
              <span className={styles.chipGroup} aria-hidden="true">
                <Nfc size={22} className={styles.contactless} />
                <span className={styles.walletChip}>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </div>
          </section>

          {/* Compact streak shortcut with a live countdown */}
          <Link to="/daily-streak" className={`${styles.streakCard} ${streak?.claimable ? styles.streakReady : ''}`}>
            <div className={styles.streakHead}>
              <span className={styles.flame}>
                <Flame size={20} />
              </span>
              <div>
                <p className={styles.kicker}>Daily streak</p>
                <strong className={loading ? styles.shimmer : ''}>{streak ? `${streak.currentStreak} day${streak.currentStreak === 1 ? '' : 's'}` : ''}</strong>
              </div>
            </div>
            <div className={styles.streakBody}>
              {streak?.claimable ? (
                <>
                  <span className={styles.streakLabel}>
                    <Sparkles size={14} /> Day {streak.currentDay} reward is ready
                  </span>
                  <span className={styles.streakCta}>
                    Claim now <ChevronRight size={16} />
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.streakLabel}>{streak?.cycleCompleted ? 'New cycle in' : `Day ${streak?.currentDay ?? ''} unlocks in`}</span>
                  <span className={styles.timer}>{streak ? formatDuration(countdownMs) : '--:--:--'}</span>
                </>
              )}
            </div>
          </Link>
        </div>

        <ul className={styles.kpis}>
          <li>
            <span className={styles.kpiIcon}>
              <Trophy size={16} />
            </span>
            <div>
              <small>Rewards claimed</small>
              <strong>{loading ? '-' : formatNumber(feed.total)}</strong>
            </div>
          </li>
          <li>
            <span className={`${styles.kpiIcon} ${styles.kpiFire}`}>
              <Flame size={16} />
            </span>
            <div>
              <small>Today</small>
              <strong>{streak ? (streak.claimable ? 'Reward ready' : 'Checked in') : '-'}</strong>
            </div>
          </li>
          <li>
            <span className={`${styles.kpiIcon} ${styles.kpiGold}`}>
              <Clock size={16} />
            </span>
            <div>
              <small>Last reward</small>
              <strong>{lastReward ? `${dayLabel(lastReward.createdAt)}, ${timeLabel(lastReward.createdAt)}` : '-'}</strong>
            </div>
          </li>
        </ul>

        <section className={styles.activity} aria-labelledby="activity-title">
          <div className={styles.activityHead}>
            <h2 id="activity-title" className={styles.sectionTitle}>
              Activity
            </h2>
            <div className={styles.filters} role="tablist" aria-label="Filter activity">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === option.id}
                  className={filter === option.id ? styles.filterOn : ''}
                  onClick={() => setFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {state.status === 'ready' && groups.length === 0 && (
            <div className={styles.empty}>
              <Receipt size={28} />
              <p>{feed.items.length === 0 ? 'No rewards yet. Claim Day 1 to see it here.' : 'Nothing in this category yet.'}</p>
              <Link to="/daily-streak" className={styles.emptyCta}>
                Go to Daily Streak <ChevronRight size={14} />
              </Link>
            </div>
          )}

          {groups.map(([label, items]) => (
            <div key={label} className={styles.group}>
              <p className={styles.groupLabel}>{label}</p>
              <ul className={styles.list}>
                {items.map((txn) => (
                  <li key={txn.transactionId} className={styles.row}>
                    <span className={`${styles.txnIcon} ${txn.currency === 'INR' ? styles.txnGift : ''}`}>
                      {txn.currency === 'INR' ? <Gift size={18} /> : <Coins size={18} />}
                    </span>
                    <div className={styles.txnBody}>
                      <strong>{txn.description || txn.source}</strong>
                      <span>
                        {timeLabel(txn.createdAt)} · {txn.referenceId}
                      </span>
                    </div>
                    <div className={styles.amount}>
                      <strong>
                        <ArrowDownLeft size={14} /> +{money(txn.currency, txn.amount)}
                      </strong>
                      <span>Balance {money(txn.currency, txn.balanceAfter)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {feed.items.length < feed.total && (
            <button type="button" className={styles.more} onClick={loadMore} disabled={feed.loadingMore}>
              {feed.loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
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
