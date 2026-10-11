import { Link } from 'react-router-dom';
import { ChevronLeft, Mail, User as UserIcon, CalendarDays, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/common/Logo';
import { formatDate } from '../../utils/format';
import styles from './ProfilePage.module.css';

/** Read-only account summary - name, email, status and member-since, all from the authenticated session. */
export default function ProfilePage() {
  const { user } = useAuth();
  const isActive = user?.status === 'ACTIVE';

  return (
    <main className={styles.page}>
      <div className={`container ${styles.container}`}>
        <header className={styles.header}>
          <Link to="/" className={styles.back} aria-label="Back to home">
            <ChevronLeft size={22} strokeWidth={2.4} />
          </Link>
          <h1 className={styles.title}>Profile</h1>
        </header>

        <section className={styles.card}>
          <div className={styles.identity}>
            <Logo size={56} />
            <div>
              <p className={styles.name}>{user?.name}</p>
              <p className={styles.email}>{user?.email}</p>
            </div>
          </div>

          <dl className={styles.fields}>
            <div className={styles.field}>
              <dt>
                <UserIcon size={15} /> Name
              </dt>
              <dd>{user?.name}</dd>
            </div>
            <div className={styles.field}>
              <dt>
                <Mail size={15} /> Email
              </dt>
              <dd>{user?.email}</dd>
            </div>
            <div className={styles.field}>
              <dt>
                <ShieldCheck size={15} /> Account status
              </dt>
              <dd>
                <span className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusSuspended}`}>{user?.status}</span>
              </dd>
            </div>
            <div className={styles.field}>
              <dt>
                <CalendarDays size={15} /> Member since
              </dt>
              <dd>{formatDate(user?.createdAt)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
