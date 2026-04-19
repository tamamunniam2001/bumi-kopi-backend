const prisma = require('../../lib/prisma')
const { handleCors, verifyToken } = require('../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { from, to, page = 1 } = req.query
    const where = {}
    if (from && to) where.createdAt = { gte: new Date(from), lte: new Date(to) }
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where, include: { cashier: { select: { name: true } }, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' }, take: 20, skip: (page - 1) * 20,
      }),
      prisma.transaction.count({ where }),
    ])
    return res.json({ transactions, total, page: Number(page), totalPages: Math.ceil(total / 20) })
  }

  if (req.method === 'POST') {
    try {
      const { items, payment, payMethod } = req.body
      if (!items?.length) return res.status(400).json({ message: 'Items tidak boleh kosong' })
      if (!payMethod) return res.status(400).json({ message: 'payMethod wajib diisi' })

      const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } })
      const orderItems = items.map((item) => {
        const product = products.find((p) => p.id === item.productId)
        if (!product) throw new Error(`Produk tidak ditemukan: ${item.productId}`)
        return { productId: item.productId, qty: item.qty, price: product.price, subtotal: product.price * item.qty }
      })

      const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0)
      const actualPayment = payment || 0
      const transaction = await prisma.$transaction(async (tx) => {
        for (const item of items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } })
        }
        return tx.transaction.create({
          data: { invoiceNo: `BK-${Date.now()}`, total, payment: actualPayment, change: actualPayment > 0 ? actualPayment - total : 0, payMethod, cashierId: user.id, items: { create: orderItems } },
          include: { items: { include: { product: true } }, cashier: true },
        })
      })
      return res.status(201).json(transaction)
    } catch (err) {
      return res.status(500).json({ message: err.message || 'Gagal menyimpan transaksi' })
    }
  }

  res.status(405).end()
}
