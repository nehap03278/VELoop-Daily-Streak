/* eslint-disable no-console */
const bcrypt = require('bcryptjs');
const { StreakConfig, StreakReward, User, Wallet, WalletTransaction } = require('../src/models');
const streakService = require('../src/services/streak.service');
const ids = require('../src/utils/ids');
const { streakConfig, streakRewards, demoUsers } = require('./data');

/** Idempotent: safe to run repeatedly. Existing users and their balances are left untouched. */
async function seedConfiguration() {
  await StreakConfig.updateOne({ key: 'default' }, { $set: streakConfig }, { upsert: true });
  await StreakReward.updateMany({ day: { $nin: streakRewards.map((reward) => reward.day) } }, { $set: { active: false } });
  for (const reward of streakRewards) {
    await StreakReward.updateOne(
      { day: reward.day, active: true },
      { $set: { badge: null, isUltimate: false, metadata: {}, ...reward, active: true } },
      { upsert: true }
    );
  }
}

async function seedDemoUsers() {
  const created = [];
  for (const demo of demoUsers) {
    if (await User.exists({ email: demo.email })) continue;
    const user = await User.create({ name: demo.name, email: demo.email, passwordHash: await bcrypt.hash(demo.password, 12) });
    await streakService.initializeUser(user._id);
    if (demo.welcomeBonus) {
      const wallet = await Wallet.findOneAndUpdate({ userId: user._id }, { $inc: { 'balances.VES': demo.welcomeBonus } }, { new: true });
      await WalletTransaction.create({
        transactionId: ids.transactionId(),
        userId: user._id,
        rewardType: 'VES',
        currency: 'VES',
        type: 'CREDIT',
        amount: demo.welcomeBonus,
        source: 'WELCOME_BONUS',
        description: 'Welcome bonus',
        referenceId: `WELCOME-${user._id}`,
        balanceBefore: wallet.balances.VES - demo.welcomeBonus,
        balanceAfter: wallet.balances.VES,
      });
    }
    created.push(demo.email);
  }
  return created;
}

module.exports = { seedConfiguration, seedDemoUsers };

if (require.main === module) {
  const { connectDB, disconnectDB } = require('../src/config/db');
  (async () => {
    await connectDB();
    await seedConfiguration();
    const created = await seedDemoUsers();
    console.log(`[seed] streak config + ${streakRewards.length} rewards upserted`);
    console.log(created.length ? `[seed] demo users created: ${created.join(', ')}` : '[seed] demo users already exist');
    await disconnectDB();
  })().catch(async (error) => {
    console.error('[seed] failed:', error);
    process.exit(1);
  });
}
