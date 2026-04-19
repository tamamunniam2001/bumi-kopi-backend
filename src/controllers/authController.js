const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const prisma = new PrismaClient()

async function login(req, res) {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) return res.status(401).json({ message: 'Email atau password salah' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ message: 'Email atau password salah' })

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '12h' })
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}

module.exports = { login }
