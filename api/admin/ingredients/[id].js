const prisma = require('../../../../lib/prisma')
const { handleCors, verifyToken } = require('../../../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return
  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })

  const { id } = req.query

  if (req.method === 'PUT') {
    const ingredient = await prisma.ingredient.update({ where: { id }, data: { name: req.body.name, unit: req.body.unit, code: req.body.code || null } })
    return res.json(ingredient)
  }

  if (req.method === 'DELETE') {
    await prisma.ingredient.delete({ where: { id } })
    return res.json({ message: 'Bahan baku dihapus' })
  }

  res.status(405).end()
}
