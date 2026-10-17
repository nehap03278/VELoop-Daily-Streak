import { CheckCircle2, Crown, Lock, Sparkles } from 'lucide-react';
import { FaAmazon } from 'react-icons/fa';
import heroCrown from '../../../assets/rewards/hero-crown.webp';
import styles from './UltimateReward.module.css';

const SEGMENT_TONE = { CLAIMED: styles.segDone, TODAY: styles.segToday, MISSED: styles.segMissed };

function StatusRow({ reward, remaining }) {
  if (reward.status === 'CLAIMED') {
    return (
      <p className={`${styles.statusRow} ${styles.claimed}`}>
        <CheckCircle2 size={15} /> Claimed - enjoy your reward!
      </p>
    );
  }
  if (reward.status === 'AVAILABLE') {
    return (
      <p className={`${styles.statusRow} ${styles.available}`}>
        <Sparkles size={15} /> Unlocked - claim it today!
      </p>
    );
  }
  return (
    <p className={styles.statusRow}>
      <span className={styles.statusLabel}>
        <Lock size={14} /> Unlocks on <b>Day {reward.unlockDay}</b>
      </span>
      <span className={styles.remaining}>
        {remaining} {remaining === 1 ? 'day' : 'days'} to go
      </span>
    </p>
  );
}

/**
 * Ultimate reward showcase. Value, type, unlock day and status are backend data (`ultimateReward`); the track
 * underneath mirrors the backend state of every day card, linking this section to the 7-day grid below.
 */
export default function UltimateReward({ reward, rewards }) {
  const remaining = rewards.filter((card) => card.state !== 'CLAIMED').length;
  const isGiftCard = reward.rewardType === 'GIFT_CARD';

  return (
    <section className={styles.panel} aria-label="Ultimate reward">
      <div className={styles.art}>
        <span className={styles.halo} aria-hidden="true" />
        <img src={heroCrown} alt="" className={styles.crown} />
      </div>

      <div className={styles.body}>
        <span className={styles.eyebrow}>
          <Crown size={13} strokeWidth={2.4} /> {reward.title}
        </span>
        <p className={styles.value}>{reward.displayValue}</p>
        <p className={styles.provider}>
          {isGiftCard && (
            <span className={styles.providerLogo}>
              <FaAmazon size={12} />
            </span>
          )}
          {reward.subtitle}
        </p>
      </div>

      <div className={styles.footer}>
        <StatusRow reward={reward} remaining={remaining} />
        <ol className={styles.track} aria-hidden="true">
          {rewards.map((card, index) => (
            <li
              key={card.day}
              className={`${styles.seg} ${SEGMENT_TONE[card.state] || ''} ${index === rewards.length - 1 ? styles.segGoal : ''}`}
            >
              {index === rewards.length - 1 && <Crown size={11} strokeWidth={2.6} />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
