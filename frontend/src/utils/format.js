const numberFormat = new Intl.NumberFormat('en-IN');

export function formatNumber(value) {
  return typeof value === 'number' ? numberFormat.format(value) : '-';
}

/** Label for a reward returned by the backend, e.g. "+10 VEs" or "₹1 Gift Card". */
export function rewardShortLabel(reward) {
  if (!reward) return '';
  return reward.rewardType === 'VES' ? `${reward.displayValue} VEs` : `${reward.displayValue} Gift Card`;
}

export function streakTitle(currentStreak) {
  if (!currentStreak) return 'Start your streak';
  return `${currentStreak} Day Streak`;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
