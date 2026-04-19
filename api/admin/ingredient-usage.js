const prisma = require('../../../lib/prisma')
const { handleCors, verifyToken } = require('../../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return
  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
  if (req.method !== 'GET') return res.status(405).end()

  const { from, to } = req.query
  const transactionWhere = { status: 'COMPLETED' }
  if (from && to) transactionWhere.createdAt = { gte: new Date(from), lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }

  const orderItems = await prisma.orderItem.findMany({
    where: { transaction: transactionWhere },
    include: { product: { include: { ingredients: { include: { ingredient: true } } } } },
  })

  const usageMap = {}
  for (const oi of orderItems) {
    for (const pi of oi.product.ingredients) {
      if (!usageMap[pi.ingredientId]) {
        usageMap[pi.ingredientId] = { ingredientId: pi.ingredientId, name: pi.ingredient.name, unit: pi.ingredient.unit, totalQty: 0 }
      }
      usageMap[pi.ingredientId].totalQty += pi.qty * oi.qty
    }
  }

  res.json(Object.values(usageMap).sort((a, b) => b.totalQty - a.totalQty))
}
