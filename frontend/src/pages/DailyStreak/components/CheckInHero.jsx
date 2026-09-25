import heroGift from '../../../assets/rewards/hero-gift.webp';
import StreakStats from './StreakStats';
import styles from './CheckInHero.module.css';

/** Tablet/desktop "Daily Check-In Rewards" hero with the statistics row. */
export default function CheckInHero({ stats }) {
  return (
    <section className={`${styles.hero} d-none d-md-flex`} aria-label="Daily check-in rewards">
      <div className={styles.top}>
        <div className={styles.art}>
          <span className={styles.glow} aria-hidden="true" />
          <img src={heroGift} alt="" className={styles.gift} />
        </div>
        <div className={styles.copy}>
          <h2 className={styles.kicker}>Daily Check-In</h2>
          <p className={styles.headline}>Rewards</p>
          <p className={styles.text}>
            Check in every day and earn <span>exciting rewards!</span>
          </p>
        </div>
      </div>
      <StreakStats stats={stats} />
    </section>
  );
}
