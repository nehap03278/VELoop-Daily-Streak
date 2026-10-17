import { Clock, Gift, Trophy } from 'lucide-react';
import { formatDuration } from '../../../utils/serverClock';
import styles from './StreakMessage.module.css';

/** Compact timer pill beside the rewards heading; copy follows backend status, times come from backend timestamps. */
export default function StreakMessage({ streak, nextReward, countdownMs, expiryMs }) {
  let Icon = Clock;
  let tone = '';
  let content;

  if (streak.claimable) {
    Icon = Gift;
    tone = styles.ready;
    content =
      streak.currentStreak > 0 && streak.streakExpiresAt ? (
        <>
          Claim within <b className={styles.time}>{formatDuration(expiryMs)}</b>
        </>
      ) : (
        <>Day {streak.currentDay} is ready</>
      );
  } else if (streak.cycleCompleted) {
    Icon = Trophy;
    content = (
      <>
        New cycle in <b className={styles.time}>{formatDuration(countdownMs)}</b>
      </>
    );
  } else {
    content = (
      <>
        {nextReward ? `${nextReward.displayValue} ${nextReward.rewardType === 'VES' ? 'VEs' : 'gift card'}` : 'Next reward'} in{' '}
        <b className={styles.time}>{formatDuration(countdownMs)}</b>
      </>
    );
  }

  return (
    <p className={`${styles.pill} ${tone}`} role="status">
      <Icon size={14} aria-hidden="true" />
      <span>{content}</span>
    </p>
  );
}
