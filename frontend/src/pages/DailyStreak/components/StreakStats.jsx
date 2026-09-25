import { CalendarRange, CheckSquare, Star } from 'lucide-react';
import styles from './StreakStats.module.css';

/** Total Rewards / Checked In / Next Reward - all three values are provided by the backend. */
export default function StreakStats({ stats }) {
  const next = stats.nextReward;
  return (
    <div className={styles.stats}>
      <div className={styles.stat}>
        <span className={`${styles.icon} ${styles.purple}`}>
          <CalendarRange size={18} />
        </span>
        <div className={styles.body}>
          <span className={styles.label}>Total Rewards</span>
          <strong className={styles.value}>{stats.totalRewards}</strong>
        </div>
      </div>
      <div className={styles.stat}>
        <span className={`${styles.icon} ${styles.green}`}>
          <CheckSquare size={18} />
        </span>
        <div className={styles.body}>
          <span className={styles.label}>Checked In</span>
          <strong className={styles.value}>{stats.checkedIn}</strong>
        </div>
      </div>
      <div className={styles.stat}>
        <span className={`${styles.icon} ${styles.gold}`}>
          <Star size={17} fill="currentColor" />
        </span>
        <div className={styles.body}>
          <span className={styles.label}>Next Reward</span>
          {next ? (
            <strong className={`${styles.value} ${styles.goldText}`}>
              {next.displayValue} <small>{next.rewardType === 'VES' ? 'VEs' : 'Gift Card'}</small>
            </strong>
          ) : (
            <strong className={styles.value}>-</strong>
          )}
        </div>
      </div>
    </div>
  );
}
