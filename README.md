## File Encryption & Decryption Tool

Modern, mobile-responsive file encryption/decryption web app built as a real-world cybersecurity portfolio project.

### Features

- **Strong encryption**: AES-256-GCM (confidentiality + tamper detection)
- **Password-based key derivation**: PBKDF2-SHA256 (server-side)
- **Multi-file + folder support**: upload many files or entire folders, download a zip result
- **Integrity check**: SHA-256 hash verified after decryption
- **Logging**: server logs encrypt/decrypt actions with timestamp
- **UX**: drag & drop, progress indicator, status messages, dark mode

### Project structure

- `client/`: React + Tailwind (Vite)
- `server/`: Node.js + Express API

### Prerequisites

- Node.js 18+ recommended

### Setup (local)

1. Install dependencies:

```bash
cd file-encryption-decryption-tool
npm run install:all
```

2. Configure environment:

- Copy `client/.env.example` → `client/.env`
- Copy `server/.env.example` → `server/.env`

3. Run backend:

```bash
cd server
npm run dev
```

4. Run frontend:

```bash
cd client
npm run dev
```

Open the UI at `http://localhost:5173`.

### Usage

1. Choose **Encrypt** or **Decrypt**
2. Select files (or a folder), enter password
3. Click **Encrypt & Download** / **Decrypt & Download**
4. The app downloads `encrypted.zip` or `decrypted.zip`

### Logs

Server action logs are written to:

- `server/logs/actions.log`

### Deployment

- **Frontend (Vercel)**: deploy `client/` as a Vite app
- **Backend (Vercel)**: deploy `server/` (includes `server/vercel.json` + `server/api/index.js`)

Make sure you set:

- `VITE_API_BASE` on the frontend (points to your deployed backend `/api`)
- `CLIENT_ORIGIN` on the backend (points to your deployed frontend)

### Security notes

- The server **never stores your password**; it derives an encryption key per file using PBKDF2.
- AES-GCM authentication prevents silent tampering (wrong password/corruption fails decryption).
- SHA-256 integrity check verifies the decrypted plaintext matches what was encrypted.

