const MAGIC = Buffer.from('FET1') // File Encryption Tool v1
const TAG_LENGTH = 16 // AES-GCM auth tag length

function buildHeader({
  saltB64,
  ivB64,
  iterations,
  originalName,
  relativePath,
  mime,
  size,
  sha256,
}) {
  return {
    v: 1,
    alg: 'aes-256-gcm',
    kdf: 'pbkdf2-sha256',
    iterations,
    salt: saltB64,
    iv: ivB64,
    meta: {
      originalName,
      relativePath: relativePath || null,
      mime: mime || 'application/octet-stream',
      size,
      sha256,
    },
    createdAt: new Date().toISOString(),
  }
}

function encodeFile({ headerObj, ciphertextPath, tag }) {
  const headerJson = Buffer.from(JSON.stringify(headerObj), 'utf8')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(headerJson.length, 0)

  return {
    prefix: Buffer.concat([MAGIC, lenBuf, headerJson]),
    ciphertextPath,
    tag, // Buffer(16)
  }
}

function parseHeaderFromBuffer(buf) {
  if (buf.length < 8) throw new Error('Invalid encrypted file (too small)')
  const magic = buf.subarray(0, 4)
  if (!magic.equals(MAGIC)) throw new Error('Invalid encrypted file (bad magic)')
  const headerLen = buf.readUInt32BE(4)
  if (headerLen <= 0 || headerLen > 5 * 1024 * 1024) {
    throw new Error('Invalid encrypted file (bad header length)')
  }
  return { headerLen }
}

module.exports = {
  MAGIC,
  TAG_LENGTH,
  buildHeader,
  encodeFile,
  parseHeaderFromBuffer,
}

