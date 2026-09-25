import calendar from '../../../assets/rewards/calendar.webp';
import gift from '../../../assets/rewards/exclusive-gift.webp';
import coin from '../../../assets/rewards/coin.webp';
import styles from './MobileHero.module.css';

/** Mobile hero banner ("Login Daily & Earn Bigger Rewards!") built from the supplied artwork. */
export default function MobileHero() {
  return (
    <section className={`${styles.hero} d-md-none`} aria-label="Daily check-in rewards">
      <div className={styles.art}>
        <img src={calendar} alt="" className={styles.calendar} />
        <img src={coin} alt="" className={`${styles.coin} ${styles.coinA}`} />
        <img src={coin} alt="" className={`${styles.coin} ${styles.coinB}`} />
      </div>
      <div className={styles.copy}>
        <p className={styles.kicker}>Login Daily &amp; Earn</p>
        <h2 className={styles.headline}>Bigger Rewards!</h2>
        <p className={styles.text}>
          Maintain your streak and unlock <span>exciting rewards</span> every day.
        </p>
      </div>
      <img src={gift} alt="" className={styles.gift} />
      <i className={`${styles.spark} ${styles.s1}`} aria-hidden="true" />
      <i className={`${styles.spark} ${styles.s2}`} aria-hidden="true" />
    </section>
  );
}
