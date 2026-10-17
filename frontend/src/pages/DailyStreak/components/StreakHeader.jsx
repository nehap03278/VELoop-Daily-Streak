import { ChevronLeft, Gem } from 'lucide-react';
import { formatNumber } from '../../../utils/format';
import styles from './StreakHeader.module.css';

/** Navbar: back action, title and VEs balance - the balance comes from the backend response. */
export default function StreakHeader({ wallet, onBack }) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={onBack} aria-label="Go back">
        <ChevronLeft size={20} strokeWidth={2.4} />
      </button>
      <div className={styles.titles}>
        <h1 className={styles.title}>Daily Streak</h1>
        <p className={`${styles.subtitle} d-none d-md-block`}>Check in every day to unlock bigger rewards.</p>
      </div>
      <div className={styles.gems} aria-label={`VEs balance ${wallet.VES}`}>
        <Gem size={15} strokeWidth={2.4} className={styles.gemIcon} />
        <span className={styles.gemValue}>{formatNumber(wallet.VES)}</span>
        <span className={styles.gemUnit}>VEs</span>
      </div>
    </header>
  );
}
