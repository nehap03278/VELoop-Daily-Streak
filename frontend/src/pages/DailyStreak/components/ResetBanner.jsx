import { RotateCcw, Check, X } from 'lucide-react';
import styles from './ResetBanner.module.css';

/** Shown after the backend detected a missed day and reset the streak (status from backend `resetNotice`). */
export default function ResetBanner({ notice }) {
  return (
    <section className={styles.banner} role="alert">
      <div className={styles.icon}>
        <RotateCcw size={20} />
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>Streak reset</h2>
        <p className={styles.text}>
          {notice.message}
          {notice.previousStreak > 0 && <> You had a {notice.previousStreak}-day streak.</>}
        </p>
        <ol className={styles.timeline} aria-label="Previous streak">
          {notice.days.map((day) => (
            <li key={day.day} className={`${styles.dot} ${styles[day.status.toLowerCase()]}`} title={`Day ${day.day}: ${day.status}`}>
              {day.status === 'CLAIMED' && <Check size={11} strokeWidth={3} />}
              {day.status === 'MISSED' && <X size={11} strokeWidth={3} />}
              {day.status === 'LOCKED' && day.day}
              <span className="visually-hidden">
                Day {day.day} {day.status.toLowerCase()}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
