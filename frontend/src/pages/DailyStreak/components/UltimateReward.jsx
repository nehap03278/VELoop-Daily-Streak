import { Lock, CheckCircle2, Sparkles } from 'lucide-react';
import { FaAmazon } from 'react-icons/fa';
import heroCrown from '../../../assets/rewards/hero-crown.webp';
import styles from './UltimateReward.module.css';

function StatusLine({ reward }) {
  if (reward.status === 'CLAIMED') {
    return (
      <span className={`${styles.statusText} ${styles.claimed}`}>
        <CheckCircle2 size={16} /> Claimed
      </span>
    );
  }
  if (reward.status === 'AVAILABLE') {
    return (
      <span className={`${styles.statusText} ${styles.available}`}>
        <Sparkles size={16} /> Unlocked today!
      </span>
    );
  }
  return (
    <span className={styles.statusText}>
      Unlock on <b>Day {reward.unlockDay}</b>
    </span>
  );
}

function ProviderChip({ reward }) {
  if (reward.rewardType !== 'GIFT_CARD') return <span className={styles.chip}>{reward.subtitle}</span>;
  return (
    <span className={styles.chip}>
      <span className={styles.chipLogo}>
        <FaAmazon size={13} />
      </span>
      {reward.subtitle}
    </span>
  );
}

/**
 * Ultimate reward panel. Day, value, type and status are backend data (`ultimateReward`), so changing the
 * reward configuration updates this section without a code change.
 */
export default function UltimateReward({ reward, variant = 'feature' }) {
  if (variant === 'compact') {
    return (
      <section className={styles.compact} aria-label="Ultimate reward">
        <div className={styles.compactArt}>
          <img src={heroCrown} alt="" className={styles.crown} />
        </div>
        <div className={styles.compactBody}>
          <p className={styles.eyebrow}>{reward.title}</p>
          <p className={styles.compactValue}>{reward.displayValue}</p>
          <ProviderChip reward={reward} />
        </div>
        <div className={styles.compactStatus}>
          <span className={`${styles.lockCircle} ${reward.status === 'CLAIMED' ? styles.lockDone : ''}`}>
            {reward.status === 'CLAIMED' ? <CheckCircle2 size={22} /> : reward.status === 'AVAILABLE' ? <Sparkles size={22} /> : <Lock size={22} />}
          </span>
          <span className={styles.compactStatusText}>
            {reward.status === 'CLAIMED' ? 'Claimed' : reward.status === 'AVAILABLE' ? 'Available' : 'Unlock on'}
            {reward.status === 'LOCKED' && <b>Day {reward.unlockDay}</b>}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.feature} d-none d-md-flex`} aria-label="Ultimate reward">
      <div className={styles.featureArt}>
        <span className={styles.halo} aria-hidden="true" />
        <img src={heroCrown} alt="" className={styles.crown} />
        <i className={`${styles.spark} ${styles.s1}`} aria-hidden="true" />
        <i className={`${styles.spark} ${styles.s2}`} aria-hidden="true" />
        <i className={`${styles.spark} ${styles.s3}`} aria-hidden="true" />
      </div>
      <div className={styles.featureBody}>
        <p className={styles.eyebrow}>{reward.title}</p>
        <p className={styles.featureValue}>{reward.displayValue}</p>
        <ProviderChip reward={reward} />
        <StatusLine reward={reward} />
      </div>
    </section>
  );
}
