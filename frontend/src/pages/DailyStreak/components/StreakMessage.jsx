import { formatDuration } from '../../../utils/serverClock';
import styles from './StreakMessage.module.css';

/** The "Come back tomorrow" strip; copy is chosen from backend status, times from backend timestamps. */
export default function StreakMessage({ streak, nextReward, countdownMs, expiryMs }) {
  let content;
  if (streak.claimable) {
    content =
      streak.currentStreak > 0 && streak.streakExpiresAt ? (
        <>
          Day {streak.currentDay} is ready! Claim within <b className={styles.time}>{formatDuration(expiryMs)}</b> to keep your streak.
        </>
      ) : (
        <>Your Day {streak.currentDay} reward is ready - claim it now!</>
      );
  } else if (streak.cycleCompleted) {
    content = (
      <>
        Cycle complete! Next cycle unlocks in <b className={styles.time}>{formatDuration(countdownMs)}</b>
      </>
    );
  } else {
    content = (
      <>
        Come back tomorrow for more rewards!{' '}
        <span className={styles.sub}>
          {nextReward ? `${nextReward.displayValue} ${nextReward.rewardType === 'VES' ? 'VEs' : 'gift card'}` : 'Next reward'} in{' '}
          <b className={styles.time}>{formatDuration(countdownMs)}</b>
        </span>
      </>
    );
  }

  return (
    <p className={styles.message} role="status">
      <span className={styles.spark} aria-hidden="true" />
      <span className={styles.text}>{content}</span>
      <span className={styles.spark} aria-hidden="true" />
    </p>
  );
}
