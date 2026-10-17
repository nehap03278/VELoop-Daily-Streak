import styles from './StreakStats.module.css';

/** Total Rewards / Checked In / Next Reward - all three values are provided by the backend. */
export default function StreakStats({ stats }) {
  const next = stats.nextReward;
  return (
    <dl className={styles.stats}>
      <div className={styles.stat}>
        <dt className={styles.label}>Total rewards</dt>
        <dd className={styles.value}>{stats.totalRewards}</dd>
      </div>
      <div className={styles.stat}>
        <dt className={styles.label}>Checked in</dt>
        <dd className={styles.value}>{stats.checkedIn}</dd>
      </div>
      <div className={styles.stat}>
        <dt className={styles.label}>Next reward</dt>
        {next ? (
          <dd className={`${styles.value} ${styles.goldText}`}>
            {next.displayValue} <small>{next.rewardType === 'VES' ? 'VEs' : 'Gift Card'}</small>
          </dd>
        ) : (
          <dd className={styles.value}>-</dd>
        )}
      </div>
    </dl>
  );
}
