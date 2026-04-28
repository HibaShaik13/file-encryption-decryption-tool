import { useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Lock, Unlock, Moon, Sun, Upload, FolderOpen, ShieldCheck, File } from 'lucide-react'
import { api } from './lib/api'
import { downloadBlob } from './lib/download'

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let u = 0
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024
    u++
  }
  return `${n.toFixed(u === 0 ? 0 : 1)} ${units[u]}`
}

function App() {
  const [mode, setMode] = useState('encrypt') // encrypt | decrypt
  const [password, setPassword] = useState('')
  const [files, setFiles] = useState([])
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ phase: null, pct: 0 })
  const [dark, setDark] = useState(() => localStorage.getItem('fet:dark') === '1')

  const folderInputRef = useRef(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('fet:dark', dark ? '1' : '0')
  }, [dark])

  const onDrop = (accepted) => {
    const normalized = accepted.map((f) => ({
      file: f,
      path: f.webkitRelativePath || f.name,
    }))
    setFiles((prev) => [...prev, ...normalized])
    setStatus({ type: 'info', text: `Added ${accepted.length} file(s).` })
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  })

  const totalBytes = useMemo(() => files.reduce((sum, f) => sum + (f.file.size || 0), 0), [files])

  const clearAll = () => {
    setFiles([])
    setStatus(null)
    setProgress({ phase: null, pct: 0 })
  }

  const pickFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    if (!picked.length) return
    onDrop(picked)
    e.target.value = ''
  }

  const pickFolder = () => {
    folderInputRef.current?.click()
  }

  async function run() {
    setStatus(null)
    if (!files.length) {
      setStatus({ type: 'error', text: 'Select at least one file (or a folder) first.' })
      return
    }
    if (mode === 'encrypt' && password.length < 6) {
      setStatus({ type: 'error', text: 'For encryption, use a password of at least 6 characters.' })
      return
    }
    if (mode === 'decrypt' && !password) {
      setStatus({ type: 'error', text: 'Enter the password used during encryption.' })
      return
    }

    const fd = new FormData()
    const paths = []
    for (const f of files) {
      fd.append('files', f.file)
      paths.push(f.path)
    }
    fd.append('password', password)
    fd.append('paths', JSON.stringify(paths))

    setBusy(true)
    setProgress({ phase: 'Uploading', pct: 0 })
    try {
      const endpoint = mode === 'encrypt' ? '/encrypt' : '/decrypt'
      const filename = mode === 'encrypt' ? 'encrypted.zip' : 'decrypted.zip'

      const res = await api.post(endpoint, fd, {
        responseType: 'blob',
        onUploadProgress: (evt) => {
          if (!evt.total) return
          const pct = Math.round((evt.loaded / evt.total) * 100)
          setProgress({ phase: 'Uploading', pct })
        },
        onDownloadProgress: (evt) => {
          if (!evt.total) return
          const pct = Math.round((evt.loaded / evt.total) * 100)
          setProgress({ phase: 'Downloading', pct })
        },
      })

      downloadBlob(res.data, filename)
      setStatus({
        type: 'success',
        text:
          mode === 'encrypt'
            ? 'Encryption complete. Downloaded encrypted.zip'
            : 'Decryption complete. Downloaded decrypted.zip',
      })
      setProgress({ phase: null, pct: 0 })
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        (mode === 'decrypt' ? 'Decryption failed.' : 'Encryption failed.')
      setStatus({ type: 'error', text: msg })
      setProgress({ phase: null, pct: 0 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                File Encryption &amp; Decryption Tool
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                AES-256-GCM • PBKDF2 • SHA-256 integrity • Zip output
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">{dark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('encrypt')}
                    className={[
                      'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                      mode === 'encrypt'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
                    ].join(' ')}
                  >
                    <Lock className="h-4 w-4" />
                    Encrypt
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('decrypt')}
                    className={[
                      'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                      mode === 'decrypt'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
                    ].join(' ')}
                  >
                    <Unlock className="h-4 w-4" />
                    Decrypt
                  </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Selected: <span className="font-semibold">{files.length}</span> •{' '}
                  <span className="font-semibold">{formatBytes(totalBytes)}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Password
                  </label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder={mode === 'encrypt' ? 'Create a strong password' : 'Enter the password'}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-400/30 focus:ring-4 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {mode === 'encrypt'
                      ? 'Key derivation uses PBKDF2-SHA256 (server-side).'
                      : 'Wrong password or tampered file will fail safely.'}
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={run}
                    disabled={busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {mode === 'encrypt' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    {busy ? 'Working…' : mode === 'encrypt' ? 'Encrypt & Download' : 'Decrypt & Download'}
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={busy}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
                <div
                  {...getRootProps()}
                  className={[
                    'cursor-pointer rounded-xl p-5 text-center transition',
                    isDragActive ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-transparent',
                  ].join(' ')}
                >
                  <input {...getInputProps()} />
                  <div className="mx-auto grid w-full max-w-md gap-2">
                    <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white shadow-sm dark:bg-slate-900">
                      <Upload className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Drag &amp; drop files here
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Or use the buttons below to choose files or a folder.
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                    <File className="h-4 w-4" />
                    Select files
                    <input type="file" multiple className="hidden" onChange={pickFiles} />
                  </label>

                  <button
                    type="button"
                    onClick={pickFolder}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Select folder
                  </button>
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={pickFiles}
                    // Non-standard attributes supported by Chromium-based browsers.
                    webkitdirectory="true"
                    directory="true"
                  />
                </div>

                {progress.phase ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">{progress.phase}</span>
                      <span className="tabular-nums">{progress.pct}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {status ? (
                  <div
                    className={[
                      'mt-4 rounded-xl border px-4 py-3 text-sm',
                      status.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
                        : status.type === 'error'
                          ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'
                          : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
                    ].join(' ')}
                  >
                    {status.text}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Selected files</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Tip: encrypted files end with <span className="font-mono">.enc</span>
              </div>

              <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pr-1">
                {files.length ? (
                  files.map((f, idx) => (
                    <div
                      key={`${f.path}-${idx}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {f.path}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatBytes(f.file.size)} • {f.file.type || 'unknown type'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                    No files selected yet.
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Security notes</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>AES-256-GCM provides confidentiality + tamper detection.</li>
                  <li>Key is derived from your password using PBKDF2-SHA256.</li>
                  <li>Decryption verifies SHA-256 integrity of the plaintext.</li>
                  <li>Server deletes temporary files after generating the download.</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Built with React + Tailwind • Backend: Node/Express
      </footer>
    </div>
  )
}

export default App
