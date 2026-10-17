import { useEffect, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ShieldCheck } from 'lucide-react';
import Modal from '../../../components/common/Modal';
import Logo from '../../../components/common/Logo';
import { rewardImage } from '../../../utils/rewardAssets';
import { formatNumber } from '../../../utils/format';
import styles from './ClaimModal.module.css';

const STEPS = [
  { key: 'starting', label: 'Eligibility' },
  { key: 'cpa', label: 'Verification' },
  { key: 'confirming', label: 'Credit' },
];

const COPY = {
  starting: { title: 'Checking eligibility', text: 'Confirming your streak with VELoop' },
  cpa: { title: 'Verifying your reward', text: 'Unlocks when the short ad ends' },
  confirming: { title: 'Crediting your reward', text: 'Securely adding it to your wallet' },
};

function Stepper({ phase }) {
  const current = STEPS.findIndex((step) => step.key === phase);
  return (
    <ol className={styles.steps}>
      {STEPS.map((step, index) => {
        const state = index < current ? styles.stepDone : index === current ? styles.stepActive : '';
        return (
          <li key={step.key} className={`${styles.step} ${state}`} aria-current={index === current ? 'step' : undefined}>
            <span className={styles.stepDot}>{index < current ? <Check size={12} strokeWidth={3.5} /> : index + 1}</span>
            <span className={styles.stepLabel}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Smooth bar for the demo; it only mirrors the server-defined duration and grants nothing itself. */
function useDemoProgress(active, seconds) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const total = seconds * 1000;
    const start = performance.now();
    let frame;
    const tick = () => {
      const value = Math.min(1, (performance.now() - start) / total);
      setProgress(value);
      if (value < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, seconds]);
  return active ? { progress, secondsLeft: Math.ceil(((1 - progress) * seconds * 1000) / 1000) } : null;
}

/**
 * Starting -> CPA Advertisement Demo -> confirming share one layout, so the dialog never jumps between steps.
 * The demo is purely presentational: the backend confirms the claim (and enforces the time) in POST /claim.
 */
function VerifyFlow({ phase, session, reward, onCancel }) {
  const demo = useDemoProgress(phase === 'cpa', session?.durationSeconds || 5);
  const copy = COPY[phase];

  let barClass = styles.barIndeterminate;
  let barStyle;
  let status = 'Please wait...';
  if (phase === 'cpa' && demo) {
    barClass = '';
    barStyle = { transform: `scaleX(${demo.progress})` };
    status = demo.secondsLeft > 0 ? `Unlocks in ${demo.secondsLeft}s` : 'Unlocking...';
  } else if (phase === 'confirming') {
    barClass = styles.barFull;
    status = 'Almost done';
  }

  return (
    <div className={styles.flow}>
      <h2 id="claim-modal-title" className={styles.title}>
        {copy.title}
      </h2>
      <p className={styles.muted}>{copy.text}</p>

      <Stepper phase={phase} />

      <div className={`${styles.stage} ${phase === 'cpa' ? styles.stageAd : ''}`}>
        {phase === 'cpa' ? (
          <>
            <span className={styles.adLabel}>Ad</span>
            <span className={styles.adShine} aria-hidden="true" />
            <Logo size={50} />
            <p className={styles.adTitle}>VELoop Rewards</p>
            <p className={styles.adText}>Sponsored content will appear here</p>
          </>
        ) : (
          <div className={styles.loaderRing}>{phase === 'confirming' ? <ShieldCheck size={34} className={styles.shield} /> : <Logo size={44} />}</div>
        )}
      </div>

      {reward ? (
        <div className={styles.rewardRow}>
          <img src={rewardImage(reward.assetType)} alt="" />
          <div className={styles.rewardText}>
            <span>Day {reward.day} reward</span>
            <b>
              {reward.displayValue} <small>{reward.subtitle}</small>
            </b>
          </div>
        </div>
      ) : (
        <div className={`${styles.rewardRow} ${styles.rewardRowSkeleton}`} aria-hidden="true" />
      )}

      <div className={styles.progressBlock}>
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Reward verification"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={phase === 'cpa' && demo ? Math.round(demo.progress * 100) : undefined}
        >
          <span className={barClass} style={barStyle} />
        </div>
        <p className={styles.wait} aria-live="polite">
          {status}
        </p>
      </div>

      <button type="button" className={styles.secondary} onClick={onCancel} disabled={phase !== 'cpa'}>
        Cancel
      </button>
    </div>
  );
}

export default function ClaimModal({ flow, previewReward, onClose }) {
  const { phase, session, reward, result, error } = flow;
  const open = phase !== 'idle';
  const busy = phase === 'starting' || phase === 'cpa' || phase === 'confirming';

  return (
    <Modal open={open} onClose={onClose} labelledBy="claim-modal-title" dismissible={!busy}>
      <div className={styles.content}>
        {busy && <VerifyFlow phase={phase} session={session} reward={reward || previewReward} onCancel={flow.cancel} />}

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
            <p className={`${styles.muted} ${styles.errorText}`}>{error?.message || 'Unable to process your reward. Please try again.'}</p>
            <button type="button" className={styles.primary} onClick={onClose}>
              Got it
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
