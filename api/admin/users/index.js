const bcrypt = require('bcryptjs')
const prisma = require('../../../lib/prisma')
const { handleCors, verifyToken } = require('../../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return
  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })

  if (req.method === 'GET') {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } })
    return res.json(users)
  }

  if (req.method === 'POST') {
    const { name, email, password, role } = req.body
    const hashed = await bcrypt.hash(password, 10)
    const newUser = await prisma.user.create({ data: { name, email, password: hashed, role } })
    return res.status(201).json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role })
  }

  res.status(405).end()
}
