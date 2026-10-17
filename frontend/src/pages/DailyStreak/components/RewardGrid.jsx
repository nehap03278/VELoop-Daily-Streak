import RewardCard from './RewardCard';
import page from '../DailyStreak.module.css';
import styles from './RewardCard.module.css';

/** The 7 (backend-configured) streak days as a connected journey: vertical on phones, horizontal on desktop. */
export default function RewardGrid({ rewards, onClaim, claimBusy, countdownMs, justClaimedDay }) {
  const claimed = rewards.filter((card) => card.state === 'CLAIMED').length;
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
          />
        ))}
      </ol>
    </section>
  );
}
