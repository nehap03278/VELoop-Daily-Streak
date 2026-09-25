import { ChevronLeft, Gem, CalendarDays } from 'lucide-react';
import flame from '../../../assets/rewards/flame.webp';
import { formatNumber, streakTitle } from '../../../utils/format';
import styles from './StreakHeader.module.css';

/** Navbar: back action, title, VEs balance and streak badge - every value comes from the backend response. */
export default function StreakHeader({ streak, wallet, onBack, onOpenCalendar }) {
  const hasStreak = streak.currentStreak > 0;
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Go back">
          <ChevronLeft size={22} strokeWidth={2.4} />
        </button>
        <div className={styles.titles}>
          <h1 className={styles.title}>
            Daily Streak
            <img src={flame} alt="" className={styles.titleFlame} />
          </h1>
          <p className={`${styles.subtitle} d-none d-lg-block`}>
            Login daily, maintain your streak, and unlock bigger rewards every day!
          </p>
        </div>
      </div>

      <div className={styles.right}>
        <button type="button" className={`${styles.calendar} d-none d-md-inline-flex`} onClick={onOpenCalendar}>
          <CalendarDays size={16} /> Streak Calendar
        </button>
        <div className={styles.gems} aria-label={`VEs balance ${wallet.VES}`}>
          <span className={styles.gemIcon}>
            <Gem size={16} strokeWidth={2.2} />
          </span>
          <span className={styles.gemValue}>{formatNumber(wallet.VES)}</span>
        </div>
        <div className={`${styles.badge} d-none d-md-flex`}>
          <img src={flame} alt="" className={styles.badgeFlame} />
          <div>
            <strong>{streakTitle(streak.currentStreak)}</strong>
            <span>{hasStreak ? 'Keep it going!' : 'Claim Day 1 to begin'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
