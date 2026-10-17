import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import Modal from '../../../components/common/Modal';
import { getHistory } from '../../../services/streakApi';
import { formatDateTime, formatDate } from '../../../utils/format';
import styles from './HistoryModal.module.css';

const CYCLE_LABEL = { ACTIVE: 'In progress', COMPLETED: 'Completed', BROKEN: 'Missed' };

/**
 * Groups check-ins under their cycle (newest cycle first), so the same day number from two different cycles -
 * e.g. Day 1 before and after a missed day - is never shown side by side.
 */
function groupByCycle(cycles, claims) {
  const groups = cycles.map((cycle) => ({ cycle, claims: [] }));
  const byNumber = new Map(groups.map((group) => [group.cycle.cycleNumber, group]));
  claims.forEach((claim) => {
    if (!byNumber.has(claim.cycleNumber)) {
      const group = { cycle: { cycleNumber: claim.cycleNumber }, claims: [] };
      byNumber.set(claim.cycleNumber, group);
      groups.push(group);
    }
    byNumber.get(claim.cycleNumber).claims.push(claim);
  });
  return groups.sort((a, b) => b.cycle.cycleNumber - a.cycle.cycleNumber);
}

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

        {state.status === 'ready' && state.data.claims.length === 0 && state.data.cycles.length === 0 && (
          <p className={styles.empty}>No check-ins yet. Claim your Day 1 reward to start your streak!</p>
        )}

        {state.status === 'ready' && (
          <div className={styles.groups}>
            {groupByCycle(state.data.cycles, state.data.claims).map(({ cycle, claims }) => (
              <section key={cycle.cycleNumber} className={`${styles.cycle} ${cycle.status ? styles[cycle.status.toLowerCase()] : ''}`}>
                <header className={styles.cycleHead}>
                  <span className={styles.cycleName}>Cycle {cycle.cycleNumber}</span>
                  {cycle.status && (
                    <span className={styles.cycleBadge}>
                      {CYCLE_LABEL[cycle.status]}
                      {cycle.missedDay ? ` Day ${cycle.missedDay}` : ''}
                    </span>
                  )}
                </header>
                {cycle.startedAt && (
                  <p className={styles.cycleMeta}>
                    {cycle.claimedDays}/{cycle.totalDays} days claimed · Started {formatDate(cycle.startedAt)}
                  </p>
                )}

                {claims.length === 0 ? (
                  <p className={styles.empty}>No check-ins in this cycle yet.</p>
                ) : (
                  <ul className={styles.list}>
                    {claims.map((claim) => (
                      <li key={claim.claimId} className={styles.row}>
                        <span className={styles.day}>
                          <small>Day</small>
                          {claim.day}
                        </span>
                        <div className={styles.rowBody}>
                          <strong>
                            {claim.reward.displayValue} {claim.reward.rewardType === 'VES' ? 'VEs' : claim.reward.subtitle}
                          </strong>
                          <span>{formatDateTime(claim.claimedAt)}</span>
                        </div>
                        <span className={styles.ref}>{claim.referenceId}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
