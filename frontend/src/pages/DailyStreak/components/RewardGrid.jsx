import RewardCard from './RewardCard';
import page from '../DailyStreak.module.css';

/** The 7 (backend-configured) streak day cards. A final ultimate reward gets the full-width row on smaller screens. */
export default function RewardGrid({ rewards, onClaim, claimBusy, countdownMs, justClaimedDay, aside }) {
  return (
    <section aria-labelledby="streak-rewards-title">
      <div className={page.sectionHead}>
        <h2 id="streak-rewards-title" className={page.sectionTitle}>
          {rewards.length}-day rewards
        </h2>
        {aside}
      </div>
      <div className={page.cardGrid}>
        {rewards.map((card, index) => (
          <RewardCard
            key={card.day}
            card={card}
            onClaim={onClaim}
            claimBusy={claimBusy}
            countdownMs={countdownMs}
            justClaimed={justClaimedDay === card.day && card.status === 'CLAIMED'}
            wide={card.reward.isUltimate && index === rewards.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
