import RewardCard from './RewardCard';
import page from '../DailyStreak.module.css';

/** The 7 (backend-configured) streak day cards. A final ultimate reward gets the full-width row on smaller screens. */
export default function RewardGrid({ rewards, onClaim, claimBusy, countdownMs, justClaimedDay }) {
  return (
    <section className={page.cardGrid} aria-label="Streak rewards">
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
    </section>
  );
}
