const path = require('path')

function envNumber(name, fallback) {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

module.exports = {
  port: envNumber('PORT', 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  maxFileBytes: envNumber('MAX_FILE_MB', 200) * 1024 * 1024,
  rateLimit: {
    windowMs: envNumber('RATE_LIMIT_WINDOW_MS', 60_000),
    max: envNumber('RATE_LIMIT_MAX', 60),
  },
  logDir: path.resolve(process.cwd(), process.env.LOG_DIR || 'logs'),
}

