const express = require('express')
const fs = require('fs')
const os = require('os')
const path = require('path')
const multer = require('multer')
const archiver = require('archiver')
const asyncHandler = require('../middleware/asyncHandler')
const { encryptFileToEnc, decryptEncToFile } = require('../crypto/cryptoService')
const { logger } = require('../logger')
const { maxFileBytes } = require('../config')

const router = express.Router()

function mkTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fet-'))
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      req._tempDir = req._tempDir || mkTempDir()
      cb(null, req._tempDir)
    },
    filename: (req, file, cb) => {
      // Preserve extension to make local debugging easier.
      const safe = file.originalname.replace(/[^\w.\-() ]+/g, '_')
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}-${safe}`)
    },
  }),
  limits: { fileSize: maxFileBytes, files: 200 },
})

function parsePathsField(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function cleanupTempDir(req) {
  const dir = req._tempDir
  if (!dir) return
  await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {})
}

router.post(
  '/encrypt',
  upload.array('files'),
  asyncHandler(async (req, res) => {
    try {
      const password = String(req.body.password || '')
      if (password.length < 6) {
        res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' })
        return
      }

      const paths = parsePathsField(req.body.paths)
      const files = req.files || []
      if (!files.length) {
        res.status(400).json({ ok: false, error: 'No files uploaded.' })
        return
      }

      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', 'attachment; filename="encrypted.zip"')

      const archive = archiver('zip', { zlib: { level: 9 } })
      archive.on('error', (err) => {
        throw err
      })
      archive.pipe(res)

      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const relativePath = typeof paths[i] === 'string' ? paths[i] : null
        const baseName = relativePath ? path.basename(relativePath) : f.originalname
        const outName = `${baseName}.enc`

        const encPath = path.join(req._tempDir, `${f.filename}.enc`)
        await encryptFileToEnc({
          inputPath: f.path,
          outputPath: encPath,
          password,
          originalName: f.originalname,
          relativePath,
          mime: f.mimetype,
          size: f.size,
        })

        const zipPath = relativePath
          ? path.posix.join(path.posix.dirname(relativePath.replaceAll('\\', '/')), outName)
          : outName

        archive.file(encPath, { name: zipPath })

        logger.info('file_action', {
          action: 'encrypt',
          fileName: f.originalname,
          relativePath: relativePath || null,
          timestamp: new Date().toISOString(),
        })
      }

      await archive.finalize()
    } finally {
      await cleanupTempDir(req)
    }
  }),
)

router.post(
  '/decrypt',
  upload.array('files'),
  asyncHandler(async (req, res) => {
    try {
      const password = String(req.body.password || '')
      if (!password) {
        res.status(400).json({ ok: false, error: 'Password is required.' })
        return
      }

      const paths = parsePathsField(req.body.paths)
      const files = req.files || []
      if (!files.length) {
        res.status(400).json({ ok: false, error: 'No files uploaded.' })
        return
      }

      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', 'attachment; filename="decrypted.zip"')

      const archive = archiver('zip', { zlib: { level: 9 } })
      archive.on('error', (err) => {
        throw err
      })
      archive.pipe(res)

      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const relativePath = typeof paths[i] === 'string' ? paths[i] : null

        const outPath = path.join(req._tempDir, `${f.filename}.out`)
        const result = await decryptEncToFile({
          inputPath: f.path,
          outputPath: outPath,
          password,
        })

        const suggestedName = result?.header?.meta?.originalName || f.originalname.replace(/\.enc$/i, '')
        const baseName = relativePath ? path.basename(relativePath).replace(/\.enc$/i, '') : suggestedName
        const zipName = relativePath
          ? path.posix.join(path.posix.dirname(relativePath.replaceAll('\\', '/')), baseName)
          : baseName

        archive.file(outPath, { name: zipName })

        logger.info('file_action', {
          action: 'decrypt',
          fileName: suggestedName,
          relativePath: relativePath || null,
          timestamp: new Date().toISOString(),
        })
      }

      await archive.finalize()
    } finally {
      await cleanupTempDir(req)
    }
  }),
)

module.exports = { cryptoRoutes: router }

