import styles from './StreakSkeleton.module.css';
import page from '../DailyStreak.module.css';

const Block = ({ className = '', style }) => <span className={`${styles.block} ${className}`} style={style} aria-hidden="true" />;

/** Theme-matched skeleton that mirrors the real layout (header, hero, stats, ultimate reward, cards, info). */
export default function StreakSkeleton() {
  return (
    <div className={page.page} aria-busy="true" aria-label="Loading your streak">
      <div className={`container-xl ${page.container}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className="d-flex align-items-center gap-3">
            <Block className={styles.circle} />
            <div>
              <Block style={{ width: 170, height: 26 }} />
              <Block className="d-none d-md-block mt-2" style={{ width: 360, height: 14 }} />
            </div>
          </div>
          <div className="d-flex gap-2">
            <Block style={{ width: 86, height: 38, borderRadius: 999 }} />
            <Block className="d-none d-md-block" style={{ width: 170, height: 58 }} />
          </div>
        </div>

        {/* Hero + ultimate reward */}
        <div className={`${page.heroGrid} d-block d-md-grid`}>
          <div className={`${styles.panel} ${styles.heroPanel}`}>
            <div className={styles.heroTop}>
              <Block className={`d-none d-md-block ${styles.heroArt}`} />
              <div className="flex-grow-1">
                <Block className="d-none d-md-block" style={{ width: '60%', height: 34 }} />
                <Block className="d-none d-md-block mt-2" style={{ width: '75%', height: 58 }} />
                <Block className="d-none d-md-block mt-3" style={{ width: '55%', height: 16 }} />
                <div className="d-flex justify-content-between d-md-none">
                  <Block style={{ width: 120, height: 32, borderRadius: 999 }} />
                  <Block style={{ width: 130, height: 32, borderRadius: 999 }} />
                </div>
              </div>
            </div>
            <div className={styles.stats}>
              {[0, 1, 2].map((i) => (
                <Block key={i} className={styles.stat} />
              ))}
            </div>
            <Block className={`d-md-none ${styles.ultimateCompact}`} />
          </div>
          <div className={`d-none d-md-flex ${styles.panel} ${styles.ultimate}`}>
            <Block className={styles.ultimateArt} />
            <div className="flex-grow-1">
              <Block style={{ width: '70%', height: 20 }} />
              <Block className="mt-2" style={{ width: '45%', height: 48 }} />
              <Block className="mt-3" style={{ width: '80%', height: 30, borderRadius: 999 }} />
            </div>
          </div>
        </div>

        <Block className={styles.message} />

        {/* Day cards */}
        <div className={page.cardGrid}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className={`${styles.panel} ${styles.card}`}>
              <Block style={{ width: '50%', height: 18, borderRadius: 999 }} />
              <Block className={styles.cardArt} />
              <Block style={{ width: '70%', height: 12 }} />
              <Block style={{ width: '40%', height: 22 }} />
              <Block style={{ width: '100%', height: 32, borderRadius: 10 }} />
            </div>
          ))}
        </div>

        {/* Info + footer */}
        <div className={`${styles.panel} ${styles.info}`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.infoItem}>
              <Block className={styles.circle} />
              <Block style={{ width: '70%', height: 12 }} />
            </div>
          ))}
        </div>
        <Block className={styles.footer} />
      </div>
    </div>
  );
}
