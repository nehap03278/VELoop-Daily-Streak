import calendar from '../../../assets/rewards/calendar.webp';
import biggerStreak from '../../../assets/rewards/bigger-streak.webp';
import exclusiveGift from '../../../assets/rewards/exclusive-gift.webp';
import shield from '../../../assets/rewards/shield.webp';
import page from '../DailyStreak.module.css';
import styles from './WhyStreak.module.css';

// Informational marketing copy (not business data).
const BENEFITS = [
  { title: 'Stay Active', text: 'Keep your streak alive & earn more!', image: calendar },
  { title: 'Bigger Streak', text: 'More consecutive logins, bigger rewards!', image: biggerStreak },
  { title: 'Exclusive Rewards', text: 'Get coins, gift cards & special bonuses!', image: exclusiveGift },
  { title: 'Don’t Miss Out', text: 'Come back every day & unlock all rewards!', image: shield },
];

export default function WhyStreak() {
  return (
    <section aria-labelledby="why-streak-title">
      <div className={page.sectionHead}>
        <h2 id="why-streak-title" className={page.sectionTitle}>
          Why keep your streak?
        </h2>
      </div>
      <ul className={styles.list}>
        {BENEFITS.map((benefit) => (
          <li key={benefit.title} className={styles.item}>
            <img src={benefit.image} alt="" className={styles.icon} loading="lazy" />
            <div>
              <h3 className={styles.title}>{benefit.title}</h3>
              <p className={styles.text}>{benefit.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
