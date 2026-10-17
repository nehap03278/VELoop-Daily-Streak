import { CalendarDays, ChevronRight, Flame } from 'lucide-react';
import StreakStats from './StreakStats';
import styles from './StreakOverview.module.css';

const SEGMENT_TONE = { CLAIMED: styles.segDone, TODAY: styles.segToday, MISSED: styles.segMissed };

/** Streak summary: current streak, cycle progress (one segment per backend card state) and stats. */
export default function StreakOverview({ streak, stats, rewards, onOpenCalendar }) {
  const claimedCount = rewards.filter((card) => card.state === 'CLAIMED').length;
  const days = streak.currentStreak;

  let hint = 'Claim Day 1 to start your streak.';
  if (streak.claimable && days > 0) hint = 'Today’s reward is ready - keep it going!';
  else if (streak.cycleCompleted) hint = 'Cycle complete - a new one starts soon.';
  else if (days > 0) hint = 'Nice! Come back tomorrow to keep it going.';

  return (
    <section className={styles.card} aria-label="Your streak">
      <div className={styles.top}>
        <span className={styles.flame} aria-hidden="true">
          <Flame size={22} strokeWidth={2.2} />
        </span>
        <div className={styles.headline}>
          <p className={styles.count}>
            {days} <span>day streak</span>
          </p>
          <p className={styles.hint}>{hint}</p>
        </div>
        <button type="button" className={styles.calendar} onClick={onOpenCalendar} aria-label="Open streak calendar">
          <CalendarDays size={16} />
          <span className={styles.calendarLabel}>Calendar</span>
          <ChevronRight size={14} className={styles.calendarChevron} />
        </button>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressHead}>
          <span>Cycle progress</span>
          <span className={styles.progressCount}>
            {claimedCount}/{rewards.length} days
          </span>
        </div>
        <ol className={styles.segments} aria-hidden="true">
          {rewards.map((card) => (
            <li key={card.day} className={`${styles.segment} ${SEGMENT_TONE[card.state] || ''}`} />
          ))}
        </ol>
      </div>

      <StreakStats stats={stats} />
    </section>
  );
}
