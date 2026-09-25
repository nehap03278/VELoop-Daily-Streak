const streakService = require('../services/streak.service');
const { audit } = require('../services/audit.service');
const { findTamperedFields } = require('../validators/streak.validators');

async function recordTampering(req) {
  const fields = findTamperedFields(req.body);
  if (fields.length > 0) {
    await audit('TAMPERED_REQUEST', {
      userId: req.user._id,
      req,
      metadata: { path: req.originalUrl, ignoredFields: fields, body: req.body },
    });
  }
}

async function getDailyStreak(req, res) {
  const data = await streakService.getDailyStreak(req.user, { req });
  res.json({ success: true, ...data });
}

async function getStatus(req, res) {
  const data = await streakService.getStatus(req.user, { req });
  res.json({ success: true, ...data });
}

async function startClaim(req, res) {
  await recordTampering(req);
  const data = await streakService.startClaim(req.user, req.validated.body, { req });
  res.status(data.cpaRequired ? 202 : 200).json({ success: true, ...data });
}

async function claim(req, res) {
  await recordTampering(req);
  const data = await streakService.finalizeClaim(req.user, req.validated.body, { req });
  res.json({ success: true, ...data });
}

async function getHistory(req, res) {
  const data = await streakService.getHistory(req.user, req.validated.query);
  res.json({ success: true, ...data });
}

module.exports = { getDailyStreak, getStatus, startClaim, claim, getHistory };
