const { logger } = require('../logger')

module.exports = function errorHandler(err, req, res, next) {
  const message = err?.message || 'Unexpected error'
  const status = err?.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 400

  logger.error('request_error', {
    message,
    status,
    path: req.path,
    method: req.method,
  })

  if (res.headersSent) return next(err)
  res.status(status).json({
    ok: false,
    error: message,
  })
}

