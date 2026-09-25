import Logo from '../../../components/common/Logo';
import flame from '../../../assets/rewards/flame.webp';
import styles from './StreakLoader.module.css';

/** Full-screen VELoop branded loader shown when the Daily Streak page first opens. */
export default function StreakLoader({ message = 'Loading your streak...' }) {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <div className={styles.emblem}>
        <span className={styles.ring} aria-hidden="true" />
        <span className={styles.halo} aria-hidden="true" />
        <Logo size={72} className={styles.logo} />
        <img src={flame} alt="" className={styles.flame} />
      </div>
      <p className={styles.brand}>
        VELoop <span>Rewards</span>
      </p>
      <p className={styles.message}>
        {message}
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </p>
    </div>
  );
}
