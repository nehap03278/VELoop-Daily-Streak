const authService = require('../services/auth.service');

async function register(req, res) {
  const result = await authService.register(req.validated.body, { req });
  res.status(201).json({ success: true, ...result });
}

async function login(req, res) {
  const result = await authService.login(req.validated.body, { req });
  res.json({ success: true, ...result });
}

async function me(req, res) {
  res.json({ success: true, user: req.user.toPublicJSON() });
}

module.exports = { register, login, me };
