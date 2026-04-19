const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function create(req, res) {
  try {
    const { items, payment, payMethod } = req.body
    const cashierId = req.user.id

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items tidak boleh kosong' })
    }
    if (!payMethod) {
      return res.status(400).json({ message: 'payMethod wajib diisi' })
    }

    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })

    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)
      if (!product) throw new Error(`Produk tidak ditemukan: ${item.productId}`)
      return { productId: item.productId, qty: item.qty, price: product.price, subtotal: product.price * item.qty }
    })

    const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0)
    const invoiceNo = `BK-${Date.now()}`
    const actualPayment = payment || 0
    const actualChange = actualPayment > 0 ? actualPayment - total : 0

    const transaction = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } })
      }
      return tx.transaction.create({
        data: { invoiceNo, total, payment: actualPayment, change: actualChange, payMethod, cashierId, items: { create: orderItems } },
        include: { items: { include: { product: true } }, cashier: true },
      })
    })

    res.status(201).json(transaction)
  } catch (err) {
    console.error('createTransaction error:', err)
    res.status(500).json({ message: err.message || 'Gagal menyimpan transaksi' })
  }
}

async function getAll(req, res) {
  const { from, to, page = 1 } = req.query
  const where = {}
  if (from && to) where.createdAt = { gte: new Date(from), lte: new Date(to) }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { cashier: { select: { name: true } }, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: (page - 1) * 20,
    }),
    prisma.transaction.count({ where }),
  ])

  res.json({ transactions, total, page: Number(page), totalPages: Math.ceil(total / 20) })
}

async function getById(req, res) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: req.params.id },
    include: { cashier: { select: { name: true } }, items: { include: { product: true } } },
  })
  if (!transaction) return res.status(404).json({ message: 'Transaksi tidak ditemukan' })
  res.json(transaction)
}

module.exports = { create, getAll, getById }
