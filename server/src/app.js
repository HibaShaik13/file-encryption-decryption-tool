const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const { cryptoRoutes } = require('./routes/cryptoRoutes')
const errorHandler = require('./middleware/errorHandler')
const { clientOrigin, rateLimit: rl } = require('./config')

const app = express()

app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(
  cors({
    origin: clientOrigin,
    credentials: false,
  }),
)
app.use(express.json({ limit: '2mb' }))

app.use(
  rateLimit({
    windowMs: rl.windowMs,
    max: rl.max,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api', cryptoRoutes)

app.use(errorHandler)

module.exports = app

