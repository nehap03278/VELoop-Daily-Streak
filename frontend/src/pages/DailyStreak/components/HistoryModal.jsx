import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import Modal from '../../../components/common/Modal';
import { getHistory } from '../../../services/streakApi';
import { formatDateTime, formatDate } from '../../../utils/format';
import styles from './HistoryModal.module.css';

const CYCLE_LABEL = { ACTIVE: 'In progress', COMPLETED: 'Completed', BROKEN: 'Missed' };

/** "Streak Calendar": the user's claim history and cycles, straight from GET /api/daily-streak/history. */
export default function HistoryModal({ open, onClose }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setState({ status: 'loading', data: null, error: null });
    getHistory({ limit: 30 })
      .then((data) => active && setState({ status: 'ready', data, error: null }))
      .catch((error) => active && setState({ status: 'error', data: null, error }));
    return () => {
      active = false;
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} labelledBy="history-title" size="lg">
      <div className={styles.content}>
        <h2 id="history-title" className={styles.title}>
          <CalendarDays size={20} /> Streak Calendar
        </h2>

        {state.status === 'loading' && (
          <div className={styles.skeletonList} aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={styles.skeleton} />
            ))}
          </div>
        )}

        {state.status === 'error' && <p className={styles.error}>{state.error.message}</p>}

        {state.status === 'ready' && (
          <>
            {state.data.cycles.length > 0 && (
              <div className={styles.cycles}>
                {state.data.cycles.map((cycle) => (
                  <div key={cycle.cycleNumber} className={`${styles.cycle} ${styles[cycle.status.toLowerCase()]}`}>
                    <span className={styles.cycleName}>Cycle {cycle.cycleNumber}</span>
                    <span className={styles.cycleMeta}>
                      {cycle.claimedDays}/{cycle.totalDays} days · {CYCLE_LABEL[cycle.status]}
                      {cycle.missedDay ? ` (Day ${cycle.missedDay} missed)` : ''}
                    </span>
                    <span className={styles.cycleDate}>Started {formatDate(cycle.startedAt)}</span>
                  </div>
                ))}
              </div>
            )}

            <h3 className={styles.subTitle}>Recent check-ins</h3>
            {state.data.claims.length === 0 ? (
              <p className={styles.empty}>No check-ins yet. Claim your Day 1 reward to start your streak!</p>
            ) : (
              <ul className={styles.list}>
                {state.data.claims.map((claim) => (
                  <li key={claim.claimId} className={styles.row}>
                    <span className={styles.day}>D{claim.day}</span>
                    <div className={styles.rowBody}>
                      <strong>
                        {claim.reward.displayValue} {claim.reward.rewardType === 'VES' ? 'VEs' : claim.reward.subtitle}
                      </strong>
                      <span>
                        Cycle {claim.cycleNumber} · {formatDateTime(claim.claimedAt)}
                      </span>
                    </div>
                    <span className={styles.ref}>{claim.referenceId}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
