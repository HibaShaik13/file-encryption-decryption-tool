app.get('/', (req, res) => {
  res.send('Server is running')
})
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const { cryptoRoutes } = require('./routes/cryptoRoutes')
const errorHandler = require('./middleware/errorHandler')
const { clientOrigin, rateLimit: rl } = require('./config')

const app = express()

app.disable('x-powered-by')

// Security
app.use(helmet({ crossOriginResourcePolicy: false }))

// ✅ FIXED CORS
app.use(
  cors({
    origin: '*', // allow all (safe for testing)
  })
)

// Body parser
app.use(express.json({ limit: '10mb' }))

// Rate limit
app.use(
  rateLimit({
    windowMs: rl.windowMs,
    max: rl.max,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Routes
app.use('/api', cryptoRoutes)

// Error handler
app.use(errorHandler)

module.exports = app