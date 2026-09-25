import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import Modal from '../../../components/common/Modal';
import Logo from '../../../components/common/Logo';
import { rewardImage } from '../../../utils/rewardAssets';
import { formatNumber } from '../../../utils/format';
import styles from './ClaimModal.module.css';

/**
 * CPA Advertisement Demo placeholder. It is purely presentational: finishing the "ad" grants nothing -
 * the backend confirms the claim (and enforces the verification time) in POST /claim.
 */
function CpaDemo({ session, reward, onCancel }) {
  const [progress, setProgress] = useState(0);
  const total = (session?.durationSeconds || 5) * 1000;

  useEffect(() => {
    const start = performance.now();
    let frame;
    const tick = () => {
      const value = Math.min(1, (performance.now() - start) / total);
      setProgress(value);
      if (value < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [total]);

  const secondsLeft = Math.ceil(((1 - progress) * total) / 1000);
  return (
    <div className={styles.cpa}>
      <p className={styles.adLabel}>Advertisement · Reward Verification</p>
      <div className={styles.adStage}>
        <span className={styles.adShine} aria-hidden="true" />
        <Logo size={54} />
        <p className={styles.adTitle}>VELoop Rewards</p>
        <p className={styles.adText}>Sponsored content will appear here</p>
        {reward && (
          <div className={styles.adReward}>
            <img src={rewardImage(reward.assetType)} alt="" />
            <span>
              Day {reward.day} · <b>{reward.displayValue}</b> {reward.subtitle}
            </span>
          </div>
        )}
      </div>
      <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      <p className={styles.wait}>Please wait... {secondsLeft > 0 ? `${secondsLeft}s` : ''}</p>
      <button type="button" className={styles.linkButton} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export default function ClaimModal({ flow, onClose }) {
  const { phase, session, reward, result, error } = flow;
  const open = phase !== 'idle';
  const busy = phase === 'starting' || phase === 'cpa' || phase === 'confirming';

  return (
    <Modal open={open} onClose={onClose} labelledBy="claim-modal-title" dismissible={!busy}>
      <div className={styles.content}>
        {phase === 'starting' && (
          <div className={styles.center}>
            <div className={styles.loaderRing}>
              <Logo size={48} />
            </div>
            <h2 id="claim-modal-title" className={styles.title}>
              Preparing your reward...
            </h2>
            <p className={styles.muted}>Checking your streak with VELoop</p>
          </div>
        )}

        {phase === 'cpa' && (
          <>
            <h2 id="claim-modal-title" className={`${styles.title} text-center`}>
              Preparing your reward...
            </h2>
            <CpaDemo session={session} reward={reward} onCancel={flow.cancel} />
          </>
        )}

        {phase === 'confirming' && (
          <div className={styles.center}>
            <div className={styles.loaderRing}>
              <ShieldCheck size={36} className={styles.shield} />
            </div>
            <h2 id="claim-modal-title" className={styles.title}>
              Confirming your reward...
            </h2>
            <p className={styles.muted}>Securely crediting your wallet</p>
          </div>
        )}

        {phase === 'success' && result && (
          <div className={styles.center}>
            <div className={styles.rewardReveal}>
              <span className={styles.rays} aria-hidden="true" />
              <img src={rewardImage(result.reward.assetType)} alt="" />
            </div>
            <p className={styles.successTag}>
              <CheckCircle2 size={16} /> Day {result.claim.day} claimed
            </p>
            <h2 id="claim-modal-title" className={styles.successValue}>
              {result.reward.displayValue} <span>{result.reward.subtitle}</span>
            </h2>
            <dl className={styles.receipt}>
              <div>
                <dt>New balance</dt>
                <dd>
                  {result.transaction.currency === 'VES'
                    ? `${formatNumber(result.transaction.balanceAfter)} VEs`
                    : `₹${formatNumber(result.transaction.balanceAfter)} gift card value`}
                </dd>
              </div>
              <div>
                <dt>Streak</dt>
                <dd>{result.streak.currentStreak} day{result.streak.currentStreak === 1 ? '' : 's'}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd className={styles.mono}>{result.claim.referenceId}</dd>
              </div>
            </dl>
            <button type="button" className={styles.primary} onClick={onClose}>
              Awesome!
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className={styles.center}>
            <div className={`${styles.loaderRing} ${styles.errorRing}`}>
              <AlertTriangle size={30} />
            </div>
            <h2 id="claim-modal-title" className={styles.title}>
              {error?.code === 'STREAK_RESET' ? 'Streak reset' : 'Reward not claimed'}
            </h2>
            <p className={styles.muted}>{error?.message || 'Unable to process your reward. Please try again.'}</p>
            <button type="button" className={styles.primary} onClick={onClose}>
              Got it
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
