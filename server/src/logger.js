const fs = require('fs')
const path = require('path')
const winston = require('winston')
const { logDir } = require('./config')

fs.mkdirSync(logDir, { recursive: true })

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'actions.log'),
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ],
})

module.exports = { logger }

