const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { pipeline } = require('stream/promises')
const { Transform } = require('stream')
const { TAG_LENGTH, buildHeader } = require('./fileFormat')

const DEFAULT_ITERATIONS = 310_000

function pbkdf2Key(password, salt, iterations) {
  return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256')
}

function sha256HexOfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const rs = fs.createReadStream(filePath)
    rs.on('data', (chunk) => hash.update(chunk))
    rs.on('error', reject)
    rs.on('end', () => resolve(hash.digest('hex')))
  })
}

function hashingPassThrough(hash) {
  return new Transform({
    transform(chunk, enc, cb) {
      try {
        hash.update(chunk)
        cb(null, chunk)
      } catch (e) {
        cb(e)
      }
    },
  })
}

async function encryptFileToEnc({
  inputPath,
  outputPath,
  password,
  originalName,
  relativePath,
  mime,
  size,
  iterations = DEFAULT_ITERATIONS,
}) {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = pbkdf2Key(password, salt, iterations)

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  // Ciphertext is streamed to a temp file first so we can append the GCM tag at the end.
  const tmpCipherPath = `${outputPath}.cipher.tmp`
  const hash = crypto.createHash('sha256')

  await pipeline(
    fs.createReadStream(inputPath),
    hashingPassThrough(hash),
    cipher,
    fs.createWriteStream(tmpCipherPath),
  )

  const tag = cipher.getAuthTag()
  if (!Buffer.isBuffer(tag) || tag.length !== TAG_LENGTH) {
    throw new Error('Encryption failed (missing auth tag)')
  }

  const sha256 = hash.digest('hex')

  const headerObj = buildHeader({
    saltB64: salt.toString('base64'),
    ivB64: iv.toString('base64'),
    iterations,
    originalName,
    relativePath,
    mime,
    size,
    sha256,
  })

  // Write final .enc: [MAGIC][headerLen][headerJson][ciphertext][tag]
  await new Promise((resolve, reject) => {
    const { MAGIC } = require('./fileFormat')
    const headerJson = Buffer.from(JSON.stringify(headerObj), 'utf8')
    const headerLenBuf = Buffer.alloc(4)
    headerLenBuf.writeUInt32BE(headerJson.length, 0)

    const ws = fs.createWriteStream(outputPath)
    ws.on('error', reject)
    ws.write(MAGIC)
    ws.write(headerLenBuf)
    ws.write(headerJson)

    const rs = fs.createReadStream(tmpCipherPath)
    rs.on('error', reject)
    rs.on('end', () => {
      ws.write(tag)
      ws.end()
    })
    ws.on('finish', resolve)
    rs.pipe(ws, { end: false })
  })

  await fs.promises.rm(tmpCipherPath, { force: true })

  return { outputPath, header: headerObj }
}

async function decryptEncToFile({ inputPath, outputPath, password }) {
  const fd = await fs.promises.open(inputPath, 'r')
  try {
    const stat = await fd.stat()
    if (stat.size < 4 + 4 + TAG_LENGTH) {
      throw new Error('Invalid encrypted file (too small)')
    }

    const prefix = Buffer.alloc(8)
    await fd.read(prefix, 0, 8, 0)
    const { parseHeaderFromBuffer } = require('./fileFormat')
    const { headerLen } = parseHeaderFromBuffer(prefix)

    const headerBuf = Buffer.alloc(headerLen)
    await fd.read(headerBuf, 0, headerLen, 8)
    const header = JSON.parse(headerBuf.toString('utf8'))

    const tagOffset = stat.size - TAG_LENGTH
    const tag = Buffer.alloc(TAG_LENGTH)
    await fd.read(tag, 0, TAG_LENGTH, tagOffset)

    const salt = Buffer.from(header.salt, 'base64')
    const iv = Buffer.from(header.iv, 'base64')
    const iterations = Number(header.iterations) || DEFAULT_ITERATIONS
    const key = pbkdf2Key(password, salt, iterations)

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)

    const cipherStart = 8 + headerLen
    const cipherEnd = tagOffset - 1
    if (cipherEnd < cipherStart) throw new Error('Invalid encrypted file (no ciphertext)')

    const hash = crypto.createHash('sha256')
    await pipeline(
      fs.createReadStream(inputPath, { start: cipherStart, end: cipherEnd }),
      decipher,
      hashingPassThrough(hash),
      fs.createWriteStream(outputPath),
    )

    const actualSha = hash.digest('hex')
    const expectedSha = header?.meta?.sha256
    if (expectedSha && expectedSha !== actualSha) {
      throw new Error('Integrity check failed (SHA-256 mismatch)')
    }

    return { outputPath, header, sha256: actualSha }
  } catch (e) {
    // Help callers detect wrong password vs corruption:
    const msg = String(e?.message || '')
    if (msg.includes('Unsupported state') || msg.includes('unable to authenticate data') || msg.includes('bad decrypt')) {
      throw new Error('Decryption failed (wrong password or corrupted file)')
    }
    throw e
  } finally {
    await fd.close()
  }
}

module.exports = {
  DEFAULT_ITERATIONS,
  sha256HexOfFile,
  encryptFileToEnc,
  decryptEncToFile,
}

