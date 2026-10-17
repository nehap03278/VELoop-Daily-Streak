import { Check, CheckCircle2, ChevronRight, Lock, XCircle } from 'lucide-react';
import { rewardImage } from '../../../utils/rewardAssets';
import { formatDuration } from '../../../utils/serverClock';
import styles from './RewardCard.module.css';

// Visual treatment follows the backend-decided `state` (TODAY | CLAIMED | MISSED | LOCKED);
// whether the claim button is shown follows the backend `status` (AVAILABLE), per spec section 34.
// Every corner indicator is the same-height chip sitting in the top row, so all cards line up.
function CornerBadge({ card }) {
  if (card.state === 'CLAIMED') {
    return (
      <span className={`${styles.badge} ${styles.badgeDone}`} aria-hidden="true">
        <Check size={12} strokeWidth={3.5} />
      </span>
    );
  }
  if (card.state === 'TODAY') return <span className={`${styles.badge} ${styles.badgeToday}`}>Today</span>;
  if (card.state === 'MISSED') return <span className={`${styles.badge} ${styles.badgeMissed}`}>Missed</span>;
  if (card.isNext) return <span className={`${styles.badge} ${styles.badgeNext}`}>Next</span>;
  if (card.reward.badge) {
    const vip = card.reward.isUltimate;
    return <span className={`${styles.badge} ${vip ? styles.badgeVip : styles.badgeType}`}>{card.reward.badge}</span>;
  }
  return null;
}

function ActionButton({ card, onClaim, claimBusy, countdownMs }) {
  if (card.status === 'CLAIMED') {
    return (
      <span className={`${styles.action} ${styles.actionClaimed}`}>
        <CheckCircle2 size={15} /> Claimed
      </span>
    );
  }
  if (card.status === 'AVAILABLE') {
    return (
      <button type="button" className={`${styles.action} ${styles.actionClaim}`} onClick={onClaim} disabled={claimBusy} aria-busy={claimBusy}>
        {claimBusy ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          <>
            <span className={styles.claimShort}>Claim</span>
            <span className={styles.claimLong}>Claim Now</span>
            <ChevronRight size={15} strokeWidth={2.6} className={styles.claimChevron} />
          </>
        )}
      </button>
    );
  }
  if (card.state === 'MISSED') {
    return (
      <span className={`${styles.action} ${styles.actionMissed}`}>
        <XCircle size={14} /> Missed
      </span>
    );
  }
  if (card.isNext && card.unlocksAt) {
    return (
      <span className={`${styles.action} ${styles.actionTimer}`} aria-label={`Unlocks in ${formatDuration(countdownMs)}`}>
        <Lock size={13} /> <span className={styles.timer}>{formatDuration(countdownMs)}</span>
      </span>
    );
  }
  return (
    <span className={`${styles.action} ${styles.actionLocked}`}>
      <Lock size={13} /> Locked
    </span>
  );
}

/** One streak day. State, status, value and badge come straight from the backend card object. */
export default function RewardCard({ card, onClaim, claimBusy, countdownMs, justClaimed, wide = false }) {
  const { reward } = card;
  const classNames = [
    styles.card,
    wide ? styles.wide : '',
    reward.isUltimate ? styles.ultimate : '',
    card.state === 'CLAIMED' ? styles.claimed : '',
    card.state === 'TODAY' ? styles.available : '',
    card.state === 'MISSED' ? styles.missed : '',
    card.isNext ? styles.next : '',
    justClaimed ? styles.justClaimed : '',
  ].join(' ');

  let valueTone = styles.valuePurple;
  if (card.state === 'CLAIMED') valueTone = styles.valueGreen;
  else if (card.state === 'MISSED') valueTone = styles.valueMissed;
  else if (card.state === 'TODAY' || reward.isUltimate) valueTone = styles.valueGold;
  const animated = reward.assetType === 'gift-box' || reward.assetType === 'crown';

  return (
    <article className={classNames} aria-label={`Day ${card.day}: ${reward.displayValue} ${reward.subtitle}, ${card.state.toLowerCase()}`}>
      <div className={styles.top}>
        <span className={`${styles.dayPill} ${reward.isUltimate ? styles.dayPillGold : ''}`}>Day {card.day}</span>
        <CornerBadge card={card} />
      </div>
      <div className={styles.art}>
        <img src={rewardImage(reward.assetType)} alt="" className={`${styles.image} ${animated ? styles.animated : ''}`} loading="lazy" />
      </div>
      <div className={styles.info}>
        <p className={styles.title}>{reward.title}</p>
        <p className={`${styles.value} ${valueTone}`}>{reward.displayValue}</p>
        <p className={styles.subtitle} title={reward.subtitle}>
          {reward.subtitle}
        </p>
      </div>
      <div className={styles.footer}>
        <ActionButton card={card} onClaim={onClaim} claimBusy={claimBusy} countdownMs={countdownMs} />
      </div>
    </article>
  );
}
