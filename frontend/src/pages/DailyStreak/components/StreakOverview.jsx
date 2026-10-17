import { CalendarDays, ChevronRight, Flame } from 'lucide-react';
import StreakStats from './StreakStats';
import styles from './StreakOverview.module.css';

/** Streak summary: current streak, a status hint and the backend statistics. */
export default function StreakOverview({ streak, stats, onOpenCalendar }) {
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

      <StreakStats stats={stats} />
    </section>
  );
}
