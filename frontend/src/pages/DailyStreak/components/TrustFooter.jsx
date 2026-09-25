import { ChevronRight } from 'lucide-react';
import Logo from '../../../components/common/Logo';
import styles from './TrustFooter.module.css';

export default function TrustFooter() {
  return (
    <footer className={styles.footer}>
      <a className={styles.strip} href="https://veloopRewards.in" target="_blank" rel="noopener noreferrer">
        <Logo size={34} className={styles.logo} />
        <span className={styles.copy}>
          <span>
            Official rewards only on <b>VeloopRewards.in</b>
          </span>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.tagline}>Stay active, stay rewarded!</span>
        </span>
        <ChevronRight size={20} className={`${styles.chevron} d-md-none`} />
      </a>
    </footer>
  );
}
