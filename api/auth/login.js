const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../../lib/prisma')
const { handleCors } = require('../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) return res.status(401).json({ message: 'Email atau password salah' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ message: 'Email atau password salah' })

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '12h' })
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}
