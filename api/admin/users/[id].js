const bcrypt = require('bcryptjs')
const prisma = require('../../../../lib/prisma')
const { handleCors, verifyToken } = require('../../../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return
  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
  if (req.method !== 'PUT') return res.status(405).end()

  const { name, email, role, isActive, password } = req.body
  const data = { name, email, role, isActive }
  if (password) data.password = await bcrypt.hash(password, 10)
  const updated = await prisma.user.update({ where: { id: req.query.id }, data, select: { id: true, name: true, email: true, role: true, isActive: true } })
  res.json(updated)
}
