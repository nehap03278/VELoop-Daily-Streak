import { Check, ChevronRight, Crown, Lock, X } from 'lucide-react';
import { rewardImage } from '../../../utils/rewardAssets';
import { formatDuration } from '../../../utils/serverClock';
import styles from './RewardCard.module.css';

// Visual treatment follows the backend-decided `state` (TODAY | CLAIMED | MISSED | LOCKED);
// whether the claim button is shown follows the backend `status` (AVAILABLE), per spec section 34.
function Node({ card }) {
  if (card.state === 'CLAIMED') return <Check size={14} strokeWidth={3} />;
  if (card.state === 'MISSED') return <X size={14} strokeWidth={3} />;
  if (card.reward.isUltimate) return <Crown size={14} strokeWidth={2.4} />;
  return <span>{card.day}</span>;
}

function Tag({ card }) {
  if (card.state === 'TODAY') return <span className={`${styles.tag} ${styles.tagToday}`}>Today</span>;
  if (card.state === 'MISSED') return <span className={`${styles.tag} ${styles.tagMissed}`}>Missed</span>;
  if (card.isNext) return <span className={`${styles.tag} ${styles.tagNext}`}>Next</span>;
  if (card.reward.badge) {
    return <span className={`${styles.tag} ${card.reward.isUltimate ? styles.tagVip : styles.tagType}`}>{card.reward.badge}</span>;
  }
  return null;
}

function Action({ card, onClaim, claimBusy, countdownMs }) {
  if (card.status === 'CLAIMED') return <span className={`${styles.action} ${styles.actionClaimed}`}>Claimed</span>;
  if (card.status === 'AVAILABLE') {
    return (
      <button type="button" className={`${styles.action} ${styles.actionClaim}`} onClick={onClaim} disabled={claimBusy} aria-busy={claimBusy}>
        {claimBusy ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          <>
            Claim <ChevronRight size={14} strokeWidth={2.6} />
          </>
        )}
      </button>
    );
  }
  if (card.state === 'MISSED') return <span className={`${styles.action} ${styles.actionMissed}`}>Missed</span>;
  if (card.isNext && card.unlocksAt) {
    return (
      <span className={`${styles.action} ${styles.actionTimer}`} aria-label={`Unlocks in ${formatDuration(countdownMs)}`}>
        {formatDuration(countdownMs)}
      </span>
    );
  }
  return (
    <span className={`${styles.action} ${styles.actionLocked}`}>
      <Lock size={12} /> {card.reward.isUltimate ? `Day ${card.day}` : 'Locked'}
    </span>
  );
}

/** One step of the streak journey. State, status, value and badge come straight from the backend card object. */
export default function RewardCard({ card, onClaim, claimBusy, countdownMs, justClaimed, isLast }) {
  const { reward } = card;
  const classNames = [
    styles.step,
    reward.isUltimate ? styles.ultimate : '',
    card.state === 'CLAIMED' ? styles.claimed : '',
    card.state === 'TODAY' ? styles.available : '',
    card.state === 'MISSED' ? styles.missed : '',
    card.isNext ? styles.next : '',
    isLast ? styles.last : '',
    justClaimed ? styles.justClaimed : '',
  ].join(' ');
  const unit = reward.rewardType === 'VES' ? 'VEs' : reward.subtitle;

  return (
    <li className={classNames} aria-label={`Day ${card.day}: ${reward.displayValue} ${reward.subtitle}, ${card.state.toLowerCase()}`}>
      <span className={styles.node} aria-hidden="true">
        <Node card={card} />
      </span>
      <div className={styles.card}>
        <div className={styles.art}>
          <img src={rewardImage(reward.assetType)} alt="" className={styles.image} loading="lazy" />
        </div>
        <div className={styles.info}>
          <div className={styles.meta}>
            <span className={styles.day}>Day {card.day}</span>
            <Tag card={card} />
          </div>
          <p className={styles.value}>
            {reward.displayValue} <span className={styles.unit}>{unit}</span>
          </p>
        </div>
        <div className={styles.footer}>
          <Action card={card} onClaim={onClaim} claimBusy={claimBusy} countdownMs={countdownMs} />
        </div>
      </div>
    </li>
  );
}
