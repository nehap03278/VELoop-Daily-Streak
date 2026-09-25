/**
 * Reward configuration from the VELoop design. This is *database seed data*: the running system reads it from
 * MongoDB, so values can be changed in the database without touching frontend or backend code.
 */
const streakConfig = {
  key: 'default',
  claimIntervalMinutes: 24 * 60, // next day unlocks 24h after the previous claim
  claimWindowMinutes: 24 * 60, // then the user has 24h to claim before the streak is missed
  cpaDemoSeconds: 5,
  claimSessionTtlMinutes: 10,
  requireCpaVerification: true,
  resetRule: 'RESET_TO_DAY_1',
  cycleCompletionRule: 'START_NEW_CYCLE',
  active: true,
};

const amazon = { provider: 'Amazon' };

const streakRewards = [
  { day: 1, rewardType: 'VES', currency: 'VES', amount: 5, title: 'Daily Reward', subtitle: '5 VEs', description: 'Kick off your streak.', assetType: 'coin', badge: null },
  { day: 2, rewardType: 'VES', currency: 'VES', amount: 10, title: 'Daily Reward', subtitle: '10 VEs', description: 'Keep the momentum going.', assetType: 'coin', badge: null },
  { day: 3, rewardType: 'VES', currency: 'VES', amount: 15, title: 'Daily Reward', subtitle: '15 VEs', description: 'Three days strong.', assetType: 'coin', badge: null },
  { day: 4, rewardType: 'GIFT_CARD', currency: 'INR', amount: 1, title: 'Daily Reward', subtitle: 'Amazon Gift Card', description: 'Your first gift card reward.', assetType: 'gift-box', badge: null, metadata: amazon },
  { day: 5, rewardType: 'GIFT_CARD', currency: 'INR', amount: 2, title: 'Daily Reward', subtitle: 'Amazon Gift Card', description: 'A bigger gift card.', assetType: 'gift-card', badge: 'Gift Card', metadata: amazon },
  { day: 6, rewardType: 'VES', currency: 'VES', amount: 30, title: 'Daily Reward', subtitle: '30 VEs', description: 'Almost at the top.', assetType: 'coin', badge: 'Coin' },
  { day: 7, rewardType: 'GIFT_CARD', currency: 'INR', amount: 5, title: 'Ultimate Reward', subtitle: 'Amazon Gift Card', description: 'Complete all 7 days for the ultimate reward.', assetType: 'crown', badge: 'VIP', isUltimate: true, metadata: amazon },
];

const demoUsers = [
  { name: 'Demo User', email: 'demo@veloop.in', password: 'Demo@1234', welcomeBonus: 100 },
  { name: 'Second Demo', email: 'demo2@veloop.in', password: 'Demo@1234', welcomeBonus: 100 },
];

module.exports = { streakConfig, streakRewards, demoUsers };
