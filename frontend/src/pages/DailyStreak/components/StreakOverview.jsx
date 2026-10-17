import { CalendarDays, ChevronRight, Flame, Gift } from 'lucide-react';
import { splitDuration } from '../../../utils/serverClock';
import { rewardShortLabel } from '../../../utils/format';
import styles from './StreakOverview.module.css';

function TimeTiles({ ms }) {
  const { hours, minutes, seconds } = splitDuration(ms);
  const parts = [
    [hours, 'hrs'],
    [minutes, 'min'],
    [seconds, 'sec'],
  ];
  return (
    <div className={styles.tiles} aria-label={`${hours} hours ${minutes} minutes ${seconds} seconds`}>
      {parts.map(([value, unit], i) => (
        <span key={unit} className={styles.tileWrap}>
          {i > 0 && <span className={styles.colon}>:</span>}
          <span className={styles.tile}>
            <b>{String(value).padStart(2, '0')}</b>
            <small>{unit}</small>
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Streak hero: progress ring (one step per backend day card), the backend-timed countdown or claim call to action,
 * and the backend statistics.
 */
export default function StreakOverview({ streak, stats, rewards, countdownMs, expiryMs, onClaim, claimBusy, onOpenCalendar }) {
  const claimed = rewards.filter((card) => card.state === 'CLAIMED').length;
  const progress = rewards.length ? Math.round((claimed / rewards.length) * 100) : 0;
  const days = streak.currentStreak;
  const nextLabel = rewardShortLabel(stats.nextReward) || 'Next reward';
  const available = rewards.find((card) => card.status === 'AVAILABLE');
  const claimLabel = available ? rewardShortLabel(available.reward) : 'reward';

  let countdown;
  if (streak.claimable) {
    const expires = days > 0 && streak.streakExpiresAt;
    countdown = (
      <div className={`${styles.countdown} ${styles.ready}`}>
        <div className={styles.countdownHead}>
          <span className={styles.countdownLabel}>
            <Gift size={14} /> Day {streak.currentDay} is ready
          </span>
          {expires && <span className={styles.countdownNote}>Keep your streak</span>}
        </div>
        {expires && <TimeTiles ms={expiryMs} />}
        <button type="button" className={styles.claim} onClick={onClaim} disabled={claimBusy} aria-busy={claimBusy}>
          {claimBusy ? <span className={styles.spinner} aria-hidden="true" /> : <>Claim {claimLabel}</>}
        </button>
      </div>
    );
  } else {
    countdown = (
      <div className={styles.countdown}>
        <div className={styles.countdownHead}>
          <span className={styles.countdownLabel}>{streak.cycleCompleted ? 'New cycle starts in' : 'Next reward unlocks in'}</span>
          {!streak.cycleCompleted && <span className={styles.countdownNote}>{nextLabel}</span>}
        </div>
        <TimeTiles ms={countdownMs} />
      </div>
    );
  }

  return (
    <section className={styles.hero} aria-label="Your streak">
      <div className={styles.top}>
        <div className={styles.ring} style={{ '--p': progress }} aria-label={`${claimed} of ${rewards.length} days claimed`}>
          <div className={styles.ringInner}>
            <b>
              {claimed}
              <span className={styles.ringTotal}>/{rewards.length}</span>
            </b>
            <small>claimed</small>
          </div>
        </div>

        <div className={styles.summary}>
          <p className={styles.kicker}>
            <Flame size={13} className={styles.flame} /> Current streak
          </p>
          <p className={styles.headline}>
            {days > 0 ? (
              <>
                You’re on a <span>{days}-day</span> streak
              </>
            ) : (
              'Start your streak today'
            )}
          </p>
          <ul className={styles.chips}>
            <li>
              <b>{stats.checkedIn}</b> {stats.checkedIn === 1 ? 'check-in' : 'check-ins'}
            </li>
            <li>
              <b>{stats.totalRewards}</b> rewards
            </li>
          </ul>
        </div>

        <button type="button" className={styles.calendar} onClick={onOpenCalendar} aria-label="Open streak calendar">
          <CalendarDays size={17} />
          <span className={styles.calendarLabel}>Calendar</span>
          <ChevronRight size={14} className={styles.calendarLabel} />
        </button>
      </div>

      {countdown}
    </section>
  );
}
