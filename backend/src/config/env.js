const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// Safe default: anything that is not explicitly development/test is treated as production, so a host that
// forgets to set NODE_ENV never falls back to insecure local defaults.
const NODE_ENV = process.env.NODE_ENV || 'production';
const isLocal = NODE_ENV === 'development' || NODE_ENV === 'test';
const isProduction = !isLocal;

function required(name, localFallback) {
  const value = process.env[name];
  if (value) return value;
  if (isLocal && localFallback !== undefined) return localFallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

function parseTrustProxy(value) {
  if (!value || value === 'false') return false;
  if (value === 'true') return 1;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : false;
}

const env = {
  NODE_ENV,
  isProduction,
  isTest: NODE_ENV === 'test',
  PORT: Number(process.env.PORT) || 5000,
  MONGO_URI: required('MONGO_URI', 'mongodb://127.0.0.1:27017/veloop_daily_streak'),
  JWT_SECRET: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  // Comma separated list of allowed browser origins for CORS (trailing slashes are ignored).
  CLIENT_URL: required('CLIENT_URL', 'http://localhost:5173'),
  // QA tooling (time travel for missed-day testing). Hard-disabled in production regardless of the variable.
  ENABLE_DEV_TOOLS: isLocal && process.env.ENABLE_DEV_TOOLS === 'true',
  DEV_TOOLS_REQUESTED: process.env.ENABLE_DEV_TOOLS === 'true',
  // "true" (= 1 hop) or a hop count on hosts behind a proxy (Render/Railway) so rate limiting sees real client IPs.
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  // Production must run claims inside MongoDB transactions (Atlas / replica set). Refuse to start otherwise.
  REQUIRE_TRANSACTIONS: process.env.REQUIRE_TRANSACTIONS ? process.env.REQUIRE_TRANSACTIONS === 'true' : isProduction,
};

env.ALLOWED_ORIGINS = env.CLIENT_URL.split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

if (isProduction && env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

module.exports = env;
