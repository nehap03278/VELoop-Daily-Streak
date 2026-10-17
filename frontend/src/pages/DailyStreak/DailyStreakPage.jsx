import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useDailyStreak } from '../../hooks/useDailyStreak';
import { useClaimFlow } from '../../hooks/useClaimFlow';
import { useCountdown } from '../../hooks/useCountdown';
import StreakLoader from './components/StreakLoader';
import StreakSkeleton from './components/StreakSkeleton';
import ErrorState from './components/ErrorState';
import StreakHeader from './components/StreakHeader';
import StreakOverview from './components/StreakOverview';
import UltimateReward from './components/UltimateReward';
import ResetBanner from './components/ResetBanner';
import RewardGrid from './components/RewardGrid';
import WhyStreak from './components/WhyStreak';
import TrustFooter from './components/TrustFooter';
import ClaimModal from './components/ClaimModal';
import HistoryModal from './components/HistoryModal';
import styles from './DailyStreak.module.css';

const BRAND_LOADER_MS = 700;
const MIN_TIMER_REFRESH_GAP_MS = 3000;

export default function DailyStreakPage() {
  const navigate = useNavigate();
  const streakState = useDailyStreak();
  const { data, status, error, serverNow, reload, retry, notifyOtherTabs, clearError } = streakState;
  const claimFlow = useClaimFlow({ reload, notifyOtherTabs });
  const [introDone, setIntroDone] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setIntroDone(true), BRAND_LOADER_MS);
    return () => window.clearTimeout(id);
  }, []);

  // When a countdown hits zero we *ask the backend* - the timer itself never unlocks anything.
  const lastTimerRefreshRef = useRef(0);
  const refreshFromBackend = useCallback(() => {
    const wait = Math.max(0, MIN_TIMER_REFRESH_GAP_MS - (performance.now() - lastTimerRefreshRef.current));
    window.setTimeout(() => {
      lastTimerRefreshRef.current = performance.now();
      reload();
    }, wait);
  }, [reload]);

  const nextClaimAt = data?.streak.nextClaimAt || null;
  const streakExpiresAt = data?.streak.claimable ? data.streak.streakExpiresAt : null;
  const countdownMs = useCountdown(nextClaimAt, serverNow, refreshFromBackend);
  const expiryMs = useCountdown(streakExpiresAt, serverNow, refreshFromBackend);

  const handleBack = useCallback(() => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate('/');
  }, [navigate]);

  if (!introDone) return <StreakLoader />;
  if (!data && status === 'loading') return <StreakSkeleton />;
  if (!data) return <ErrorState error={error} onRetry={retry} />;

  const justClaimedDay = claimFlow.phase === 'success' ? claimFlow.result?.claim.day : null;
  // Display-only preview so the claim dialog shows the reward before /claim/start answers; the backend's own reward replaces it.
  const claimableCard = data.rewards.find((card) => card.status === 'AVAILABLE');
  const previewReward = claimableCard ? { ...claimableCard.reward, day: claimableCard.day } : null;

  return (
    <div className={styles.page}>
      <div className={`container-xl ${styles.container}`}>
        <StreakHeader wallet={data.wallet} onBack={handleBack} />

        {data.resetNotice && <ResetBanner notice={data.resetNotice} />}

        <div className={styles.heroGrid}>
          <StreakOverview
            streak={data.streak}
            stats={data.stats}
            rewards={data.rewards}
            countdownMs={countdownMs}
            expiryMs={expiryMs}
            onClaim={claimFlow.claim}
            claimBusy={claimFlow.isBusy}
            onOpenCalendar={() => setHistoryOpen(true)}
          />
          <UltimateReward reward={data.ultimateReward} rewards={data.rewards} />
        </div>

        <RewardGrid
          rewards={data.rewards}
          onClaim={claimFlow.claim}
          claimBusy={claimFlow.isBusy}
          countdownMs={countdownMs}
          justClaimedDay={justClaimedDay}
        />

        <WhyStreak />
        <TrustFooter />
      </div>

      {error && status === 'ready' && (
        <div className={styles.toast} role="alert">
          <AlertTriangle size={18} />
          <span>{error.message}</span>
          <button type="button" onClick={clearError} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      <ClaimModal flow={claimFlow} previewReward={previewReward} onClose={claimFlow.close} />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
