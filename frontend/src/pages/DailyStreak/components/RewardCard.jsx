import { Check, ChevronRight, Crown, Lock, Sparkles, X } from 'lucide-react';
import { rewardImage } from '../../../utils/rewardAssets';
import { formatDuration } from '../../../utils/serverClock';
import styles from './RewardCard.module.css';

// Each gift gets its own glow colour, keyed by the backend assetType.
const ART_TONE = { coin: styles.toneCoin, 'gift-box': styles.toneGift, 'gift-card': styles.toneCard, crown: styles.toneCrown };

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

function Action({ card, onClaim, claimBusy, countdownMs, eta }) {
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
  if (card.reward.isUltimate) {
    return (
      <span className={`${styles.action} ${styles.actionLocked}`}>
        <Lock size={12} /> Unlocks on Day {card.day}
        {eta && <span className={styles.etaInline}> · {eta === 1 ? 'tomorrow' : `in ${eta} days`}</span>}
      </span>
    );
  }
  return (
    <span className={`${styles.action} ${styles.actionLocked}`}>
      <Lock size={12} /> {eta ? (eta === 1 ? 'Tomorrow' : `In ${eta} days`) : 'Locked'}
    </span>
  );
}

/** One step of the streak journey. State, status, value and badge come straight from the backend card object. */
export default function RewardCard({ card, onClaim, claimBusy, countdownMs, justClaimed, isLast, eta }) {
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
        <div className={`${styles.art} ${ART_TONE[reward.assetType] || ''}`}>
          <img src={rewardImage(reward.assetType)} alt="" className={styles.image} loading="lazy" />
          {(reward.rewardType === 'GIFT_CARD' || card.state === 'TODAY') && (
            <span className={styles.sparkles} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
          {card.state === 'TODAY' && (
            <span className={styles.confetti} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
        <div className={styles.info}>
          {reward.isUltimate && (
            <span className={styles.ribbon}>
              <Sparkles size={11} strokeWidth={2.6} /> Grand prize
            </span>
          )}
          <div className={styles.meta}>
            <span className={styles.day}>Day {card.day}</span>
            <Tag card={card} />
          </div>
          <p className={styles.value}>
            <span className={styles.amount}>{reward.displayValue}</span> <span className={styles.unit}>{unit}</span>
          </p>
        </div>
        <div className={styles.footer}>
          <Action card={card} onClaim={onClaim} claimBusy={claimBusy} countdownMs={countdownMs} eta={eta} />
        </div>
      </div>
    </li>
  );
}
