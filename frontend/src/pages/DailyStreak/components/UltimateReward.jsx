import { CheckCircle2, Crown, Lock, Sparkles } from 'lucide-react';
import { FaAmazon } from 'react-icons/fa';
import heroCrown from '../../../assets/rewards/hero-crown.webp';
import styles from './UltimateReward.module.css';

function Status({ reward, remaining }) {
  if (reward.status === 'CLAIMED') {
    return (
      <span className={`${styles.status} ${styles.claimed}`}>
        <CheckCircle2 size={14} /> Claimed
      </span>
    );
  }
  if (reward.status === 'AVAILABLE') {
    return (
      <span className={`${styles.status} ${styles.available}`}>
        <Sparkles size={14} /> Unlocked today
      </span>
    );
  }
  return (
    <span className={styles.status}>
      <Lock size={13} /> {remaining} {remaining === 1 ? 'day' : 'days'} to go
    </span>
  );
}

/**
 * Ultimate reward showcase. Value, type, unlock day and status are backend data (`ultimateReward`); the progress
 * bar mirrors how many backend day cards are claimed.
 */
export default function UltimateReward({ reward, rewards }) {
  const claimed = rewards.filter((card) => card.state === 'CLAIMED').length;
  const remaining = rewards.length - claimed;
  const progress = rewards.length ? Math.round((claimed / rewards.length) * 100) : 0;

  return (
    <section className={styles.panel} aria-label="Ultimate reward">
      <div className={styles.glow} aria-hidden="true" />
      <img src={heroCrown} alt="" className={styles.crown} />

      <div className={styles.body}>
        <span className={styles.eyebrow}>
          <Crown size={12} strokeWidth={2.6} /> {reward.title}
        </span>
        <p className={styles.value}>{reward.displayValue}</p>
        <p className={styles.provider}>
          {reward.rewardType === 'GIFT_CARD' && (
            <span className={styles.providerLogo}>
              <FaAmazon size={11} />
            </span>
          )}
          {reward.subtitle}
        </p>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerHead}>
          <span>
            Unlocks on <b>Day {reward.unlockDay}</b>
          </span>
          <Status reward={reward} remaining={remaining} />
        </div>
        <div className={styles.bar} aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}
