const jwt = require('jsonwebtoken')

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://bumikopi.vercel.app',
]

function setCors(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,ngrok-skip-browser-warning')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

function handleCors(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

function verifyToken(req, res) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) { res.status(401).json({ message: 'Token tidak ada' }); return null }
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    res.status(401).json({ message: 'Token tidak valid' }); return null
  }
}

module.exports = { handleCors, setCors, verifyToken }
