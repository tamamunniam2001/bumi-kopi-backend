require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001']
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/products', require('./routes/products'))
app.use('/api/transactions', require('./routes/transactions'))
app.use('/api/admin', require('./routes/admin'))

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Bumi Kopi API' }))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Bumi Kopi API berjalan di port ${PORT}`))
