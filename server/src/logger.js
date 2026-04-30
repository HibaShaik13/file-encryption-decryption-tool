const fs = require('fs')
const path = require('path')
const winston = require('winston')
const { logDir } = require('./config')

const isVercel = Boolean(process.env.VERCEL)
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
]

if (!isVercel) {
  try {
    fs.mkdirSync(logDir, { recursive: true })
    transports.unshift(
      new winston.transports.File({
        filename: path.join(logDir, 'actions.log'),
      }),
    )
  } catch {
    // Fall back to console-only logging if file logging isn't available.
  }
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports,
})

module.exports = { logger }

