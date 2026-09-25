const { StreakConfig } = require('../models');
const AppError = require('../utils/AppError');

async function getStreakConfig() {
  const config = await StreakConfig.findOne({ key: 'default', active: true }).lean();
  if (!config) {
    throw new AppError(503, 'STREAK_NOT_CONFIGURED', 'Daily streak is not available right now. Please try again later.');
  }
  return config;
}

module.exports = { getStreakConfig };
