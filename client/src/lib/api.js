import axios from 'axios'

export const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'

export const api = axios.create({
  baseURL: apiBase,
  timeout: 0, // allow large files
})

