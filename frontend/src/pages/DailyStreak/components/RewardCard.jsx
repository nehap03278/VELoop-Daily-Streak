import { Check, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { rewardImage } from '../../../utils/rewardAssets';
import { formatDuration } from '../../../utils/serverClock';
import styles from './RewardCard.module.css';

function CornerBadge({ card }) {
  if (card.status === 'CLAIMED') {
    return (
      <span className={styles.claimedMark} aria-hidden="true">
        <Check size={12} strokeWidth={3.5} />
      </span>
    );
  }
  if (card.isToday) return <span className={`${styles.tab} ${styles.tabToday}`}>Today</span>;
  if (card.isNext) return <span className={`${styles.tab} ${styles.tabNext}`}>Next</span>;
  if (card.reward.badge) {
    const vip = card.reward.isUltimate;
    return <span className={`${styles.pill} ${vip ? styles.pillGold : ''}`}>{card.reward.badge}</span>;
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
            <span className="d-none d-xl-inline">Claim Reward</span>
            <span className="d-xl-none">Claim Now</span>
            <ChevronRight size={15} strokeWidth={2.6} />
          </>
        )}
      </button>
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

/** One streak day. Status, value and badge come straight from the backend card object. */
export default function RewardCard({ card, onClaim, claimBusy, countdownMs, justClaimed }) {
  const { reward } = card;
  const classNames = [
    styles.card,
    reward.isUltimate ? styles.ultimate : '',
    card.status === 'CLAIMED' ? styles.claimed : '',
    card.status === 'AVAILABLE' ? styles.available : '',
    card.isNext ? styles.next : '',
    justClaimed ? styles.justClaimed : '',
  ].join(' ');

  const valueTone = card.status === 'CLAIMED' ? styles.valueGreen : card.status === 'AVAILABLE' || reward.isUltimate ? styles.valueGold : styles.valuePurple;
  const hasCorner = card.status === 'CLAIMED' || card.isToday || card.isNext || Boolean(reward.badge);
  const animated = reward.assetType === 'gift-box' || reward.assetType === 'crown';

  return (
    <article className={classNames} aria-label={`Day ${card.day}: ${reward.displayValue} ${reward.subtitle}, ${card.status.toLowerCase()}`}>
      <div className={`${styles.top} ${hasCorner ? styles.topSplit : ''}`}>
        <span className={`${styles.dayPill} ${reward.isUltimate ? styles.dayPillGold : ''}`}>Day {card.day}</span>
        <CornerBadge card={card} />
      </div>
      {card.isNext && <span className={styles.nextCaption}>Next reward</span>}
      <div className={styles.art}>
        <img src={rewardImage(reward.assetType)} alt="" className={`${styles.image} ${animated ? styles.animated : ''}`} loading="lazy" />
      </div>
      <p className={styles.title}>{reward.title}</p>
      <p className={`${styles.value} ${valueTone}`}>{reward.displayValue}</p>
      <p className={styles.subtitle}>{reward.subtitle}</p>
      <ActionButton card={card} onClaim={onClaim} claimBusy={claimBusy} countdownMs={countdownMs} />
    </article>
  );
}
