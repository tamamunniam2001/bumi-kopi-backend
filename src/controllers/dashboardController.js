const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getDashboard(req, res) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  // 7 hari terakhir untuk chart
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d
  })

  const [todayTx, monthTx, totalProducts, recentTx, weeklyRaw, topProducts] = await Promise.all([
    prisma.transaction.aggregate({
      where: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' },
      _sum: { total: true }, _count: true,
    }),
    prisma.transaction.aggregate({
      where: { createdAt: { gte: thisMonth }, status: 'COMPLETED' },
      _sum: { total: true }, _count: true,
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.transaction.findMany({
      take: 8, orderBy: { createdAt: 'desc' },
      include: { cashier: { select: { name: true } } },
    }),
    prisma.transaction.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: days[0] }, status: 'COMPLETED' },
      _sum: { total: true }, _count: true,
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 5,
    }),
  ])

  // Format chart data per hari
  const chartData = days.map((d) => {
    const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
    const dayStart = new Date(d)
    const dayEnd = new Date(d)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const dayTx = weeklyRaw.filter((t) => new Date(t.createdAt) >= dayStart && new Date(t.createdAt) < dayEnd)
    const revenue = dayTx.reduce((s, t) => s + (t._sum.total || 0), 0)
    const count = dayTx.reduce((s, t) => s + t._count, 0)
    return { label, revenue, count }
  })

  // Top products dengan nama
  const productIds = topProducts.map((p) => p.productId)
  const productNames = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
  const topProductsFormatted = topProducts.map((p) => {
    const prod = productNames.find((n) => n.id === p.productId)
    return { name: prod?.name || 'Unknown', qty: p._sum.qty || 0, revenue: p._sum.subtotal || 0 }
  })

  res.json({
    today: { revenue: todayTx._sum.total || 0, transactions: todayTx._count },
    month: { revenue: monthTx._sum.total || 0, transactions: monthTx._count },
    totalProducts,
    recentTransactions: recentTx,
    chartData,
    topProducts: topProductsFormatted,
  })
}

module.exports = { getDashboard }
