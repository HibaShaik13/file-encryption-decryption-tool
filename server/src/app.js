const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const { cryptoRoutes } = require('./routes/cryptoRoutes')
const errorHandler = require('./middleware/errorHandler')
const { rateLimit: rl } = require('./config')

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json())

// ✅ routes AFTER app initialization
app.get('/', (req, res) => {
  res.send('Server is running')
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api', cryptoRoutes)

app.use(errorHandler)

module.exports = app