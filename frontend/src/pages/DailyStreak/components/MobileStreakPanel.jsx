import { CalendarDays, ChevronRight } from 'lucide-react';
import flame from '../../../assets/rewards/flame.webp';
import { streakTitle } from '../../../utils/format';
import StreakStats from './StreakStats';
import UltimateReward from './UltimateReward';
import styles from './MobileStreakPanel.module.css';

/** Mobile-only summary panel: streak pill, Streak Calendar, stats and compact ultimate reward. */
export default function MobileStreakPanel({ streak, stats, ultimateReward, onOpenCalendar }) {
  return (
    <section className={`${styles.panel} d-md-none`} aria-label="Your streak">
      <div className={styles.row}>
        <span className={styles.streakPill}>
          <img src={flame} alt="" />
          {streakTitle(streak.currentStreak)}
        </span>
        <button type="button" className={styles.calendar} onClick={onOpenCalendar}>
          <CalendarDays size={15} /> Streak Calendar <ChevronRight size={14} />
        </button>
      </div>
      <StreakStats stats={stats} />
      <UltimateReward reward={ultimateReward} variant="compact" />
    </section>
  );
}
