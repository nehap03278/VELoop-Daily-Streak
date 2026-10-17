import { Clock, Gift, Trophy } from 'lucide-react';
import { formatDuration } from '../../../utils/serverClock';
import styles from './StreakMessage.module.css';

/** The "Come back tomorrow" strip; copy is chosen from backend status, times from backend timestamps. */
export default function StreakMessage({ streak, nextReward, countdownMs, expiryMs }) {
  let Icon = Clock;
  let tone = '';
  let title;
  let detail;

  if (streak.claimable) {
    Icon = Gift;
    tone = styles.ready;
    title = `Day ${streak.currentDay} reward is ready`;
    detail =
      streak.currentStreak > 0 && streak.streakExpiresAt ? (
        <>
          Claim within <b className={styles.time}>{formatDuration(expiryMs)}</b> to keep your streak.
        </>
      ) : (
        'Claim it now to start your streak.'
      );
  } else if (streak.cycleCompleted) {
    Icon = Trophy;
    title = 'Cycle complete!';
    detail = (
      <>
        Next cycle unlocks in <b className={styles.time}>{formatDuration(countdownMs)}</b>
      </>
    );
  } else {
    title = 'Come back tomorrow';
    detail = (
      <>
        {nextReward ? `${nextReward.displayValue} ${nextReward.rewardType === 'VES' ? 'VEs' : 'gift card'}` : 'Next reward'} unlocks in{' '}
        <b className={styles.time}>{formatDuration(countdownMs)}</b>
      </>
    );
  }

  return (
    <div className={`${styles.message} ${tone}`} role="status">
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <p className={styles.text}>
        <strong>{title}</strong>
        <span>{detail}</span>
      </p>
    </div>
  );
}
