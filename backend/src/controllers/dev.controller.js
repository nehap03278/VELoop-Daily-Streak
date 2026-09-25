const devService = require('../services/dev.service');

async function timeTravel(req, res) {
  const data = await devService.timeTravel(req.user, req.validated.body.hours, { req });
  res.json({ success: true, ...data });
}

async function resetMyStreak(req, res) {
  const data = await devService.resetMyStreak(req.user, { req });
  res.json({ success: true, ...data });
}

module.exports = { timeTravel, resetMyStreak };
