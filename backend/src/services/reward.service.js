const { StreakReward } = require('../models');
const AppError = require('../utils/AppError');

const CURRENCY_SYMBOLS = { INR: '₹' };

/** Active rewards ordered by day. Days must form a contiguous 1..N sequence. */
async function getActiveRewards() {
  const rewards = await StreakReward.find({ active: true }).sort({ day: 1 }).lean();
  const contiguous = rewards.length > 0 && rewards.every((reward, index) => reward.day === index + 1);
  if (!contiguous) {
    throw new AppError(503, 'STREAK_NOT_CONFIGURED', 'Daily streak rewards are not available right now.');
  }
  return rewards;
}

function displayValue(reward) {
  if (reward.rewardType === 'VES') return `+${reward.amount}`;
  const symbol = CURRENCY_SYMBOLS[reward.currency] || '';
  return `${symbol}${reward.amount}`;
}

/** Public representation of a reward returned to the client. */
function toRewardDTO(reward) {
  return {
    id: reward._id.toString(),
    day: reward.day,
    rewardType: reward.rewardType,
    currency: reward.currency,
    amount: reward.amount,
    displayValue: displayValue(reward),
    title: reward.title,
    subtitle: reward.subtitle,
    description: reward.description,
    assetType: reward.assetType,
    badge: reward.badge,
    isUltimate: reward.isUltimate,
    provider: reward.metadata && reward.metadata.provider ? reward.metadata.provider : null,
  };
}

function getUltimateReward(rewards) {
  return rewards.find((reward) => reward.isUltimate) || rewards[rewards.length - 1];
}

module.exports = { getActiveRewards, toRewardDTO, displayValue, getUltimateReward };
