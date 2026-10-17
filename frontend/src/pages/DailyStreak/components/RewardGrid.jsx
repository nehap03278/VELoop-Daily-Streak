import { Gift } from 'lucide-react';
import { formatNumber } from '../../../utils/format';
import RewardCard from './RewardCard';
import page from '../DailyStreak.module.css';
import styles from './RewardCard.module.css';

/** Adds up the backend reward amounts still waiting this cycle, e.g. "55 VEs + ₹8 in gift cards". */
function haulLabel(rewards) {
  const open = rewards.filter((card) => card.state !== 'CLAIMED' && card.state !== 'MISSED');
  const ves = open.filter((c) => c.reward.rewardType === 'VES').reduce((sum, c) => sum + (c.reward.amount || 0), 0);
  const cards = open.filter((c) => c.reward.rewardType === 'GIFT_CARD');
  const cardTotal = cards.reduce((sum, c) => sum + (c.reward.amount || 0), 0);
  const parts = [];
  if (ves) parts.push(`${formatNumber(ves)} VEs`);
  if (cardTotal) parts.push(`${cards[0].reward.currency === 'INR' ? '₹' : ''}${formatNumber(cardTotal)} in gift cards`);
  return parts.join(' + ');
}

/** The 7 (backend-configured) streak days as a connected journey: vertical on phones, horizontal on desktop. */
export default function RewardGrid({ rewards, onClaim, claimBusy, countdownMs, justClaimedDay }) {
  const claimed = rewards.filter((card) => card.state === 'CLAIMED').length;
  const haul = haulLabel(rewards);

  // "Tomorrow" / "In 3 days" labels, counted from the first open card the backend returned.
  const baseIndex = rewards.findIndex((card) => card.status === 'AVAILABLE' || card.isNext);
  const baseOffset = baseIndex >= 0 && rewards[baseIndex].status === 'AVAILABLE' ? 0 : 1;
  const etaFor = (index) => (baseIndex >= 0 && index > baseIndex ? index - baseIndex + baseOffset : null);

  return (
    <section aria-labelledby="streak-rewards-title">
      <div className={page.sectionHead}>
        <h2 id="streak-rewards-title" className={page.sectionTitle}>
          Your {rewards.length}-day journey
        </h2>
        <span className={page.sectionMeta}>
          {claimed} of {rewards.length} claimed
        </span>
      </div>

      {haul && (
        <p className={styles.haul}>
          <span className={styles.haulIcon} aria-hidden="true">
            <Gift size={16} />
          </span>
          <span>
            Still up for grabs: <b>{haul}</b>
          </span>
        </p>
      )}

      <ol className={styles.journey}>
        {rewards.map((card, index) => (
          <RewardCard
            key={card.day}
            card={card}
            onClaim={onClaim}
            claimBusy={claimBusy}
            countdownMs={countdownMs}
            justClaimed={justClaimedDay === card.day && card.status === 'CLAIMED'}
            isLast={index === rewards.length - 1}
            eta={etaFor(index)}
          />
        ))}
      </ol>
    </section>
  );
}
