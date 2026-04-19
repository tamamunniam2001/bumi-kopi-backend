const prisma = require('../../../lib/prisma')
const { handleCors, verifyToken } = require('../../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const ingredients = await prisma.ingredient.findMany({ orderBy: { name: 'asc' } })
    return res.json(ingredients)
  }

  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })

  if (req.method === 'POST') {
    const { name, unit, code } = req.body
    const ingredient = await prisma.ingredient.create({ data: { name, unit, code: code || null } })
    return res.status(201).json(ingredient)
  }

  res.status(405).end()
}
