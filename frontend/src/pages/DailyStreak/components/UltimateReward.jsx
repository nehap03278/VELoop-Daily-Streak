import { Lock, CheckCircle2, Sparkles } from 'lucide-react';
import { FaAmazon } from 'react-icons/fa';
import heroCrown from '../../../assets/rewards/hero-crown.webp';
import styles from './UltimateReward.module.css';

function StatusPill({ reward }) {
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
      <Lock size={13} /> Day {reward.unlockDay}
    </span>
  );
}

function ProviderChip({ reward }) {
  if (reward.rewardType !== 'GIFT_CARD') return <span className={styles.chip}>{reward.subtitle}</span>;
  return (
    <span className={styles.chip}>
      <FaAmazon size={12} className={styles.chipLogo} />
      {reward.subtitle}
    </span>
  );
}

/**
 * Ultimate reward panel. Day, value, type and status are backend data (`ultimateReward`), so changing the
 * reward configuration updates this section without a code change.
 */
export default function UltimateReward({ reward, variant = 'feature' }) {
  const visibility = variant === 'compact' ? 'd-md-none' : 'd-none d-md-flex';
  return (
    <section className={`${styles.panel} ${styles[variant]} ${visibility}`} aria-label="Ultimate reward">
      <div className={styles.art}>
        <img src={heroCrown} alt="" className={styles.crown} />
      </div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>{reward.title}</p>
        <p className={styles.value}>{reward.displayValue}</p>
        <ProviderChip reward={reward} />
      </div>
      <StatusPill reward={reward} />
    </section>
  );
}
