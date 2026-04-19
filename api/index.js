const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')

const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://bumikopi.vercel.app']

function setCors(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,ngrok-skip-browser-warning')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

function verifyToken(req, res) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) { res.status(401).json({ message: 'Token tidak ada' }); return null }
  try { return jwt.verify(token, process.env.JWT_SECRET) }
  catch { res.status(401).json({ message: 'Token tidak valid' }); return null }
}

module.exports = async (req, res) => {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url, method } = req
  const path = url.split('?')[0]
  const query = Object.fromEntries(new URL(url, 'http://x').searchParams)

  // Health
  if (path === '/api/health') return res.json({ status: 'ok', app: 'Bumi Kopi API' })

  // Auth
  if (path === '/api/auth/login' && method === 'POST') {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) return res.status(401).json({ message: 'Email atau password salah' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ message: 'Email atau password salah' })
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '12h' })
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  }

  // Products
  if (path === '/api/products' && method === 'GET') {
    const user = verifyToken(req, res); if (!user) return
    const products = await prisma.product.findMany({ where: { isActive: true }, include: { category: true, ingredients: { include: { ingredient: true } } }, orderBy: { name: 'asc' } })
    return res.json(products)
  }
  if (path === '/api/products' && method === 'POST') {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    try {
      const { code, name, price, stock, imageUrl, categoryId } = req.body
      const product = await prisma.product.create({ data: { code: code || null, name, price, stock, imageUrl: imageUrl || null, categoryId } })
      return res.status(201).json(product)
    } catch (e) {
      if (e.code === 'P2002') return res.status(400).json({ message: 'Kode produk sudah digunakan' })
      return res.status(500).json({ message: 'Gagal menyimpan produk' })
    }
  }
  if (path === '/api/products/bulk' && method === 'POST') {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    const { products: rows } = req.body
    if (!rows?.length) return res.status(400).json({ message: 'Data kosong' })
    const allCats = await prisma.category.findMany()
    const catMap = Object.fromEntries(allCats.map((c) => [c.name.toLowerCase(), c.id]))
    const results = { created: 0, updated: 0, skipped: 0, errors: [] }
    for (const row of rows) {
      const { name, code, price, stock, category: catName, imageUrl } = row
      if (!name || !price || !catName) { results.skipped++; continue }
      const categoryId = catMap[catName.toLowerCase()]
      if (!categoryId) { results.errors.push(`Kategori "${catName}" tidak ditemukan`); results.skipped++; continue }
      try {
        const existing = await prisma.product.findFirst({ where: { name } })
        if (existing) { await prisma.product.update({ where: { id: existing.id }, data: { code: code || null, price, stock, categoryId, imageUrl: imageUrl || null } }); results.updated++ }
        else { await prisma.product.create({ data: { code: code || null, name, price, stock, categoryId, imageUrl: imageUrl || null } }); results.created++ }
      } catch (e) { results.errors.push(`Gagal: ${name}`); results.skipped++ }
    }
    return res.json(results)
  }
  const productMatch = path.match(/^\/api\/products\/([^/]+)$/)
  if (productMatch) {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    const id = productMatch[1]
    if (method === 'PUT') {
      try {
        const { code, name, price, stock, imageUrl, categoryId } = req.body
        const product = await prisma.product.update({ where: { id }, data: { code: code || null, name, price, stock, imageUrl: imageUrl || null, categoryId } })
        return res.json(product)
      } catch (e) {
        if (e.code === 'P2002') return res.status(400).json({ message: 'Kode produk sudah digunakan' })
        return res.status(500).json({ message: 'Gagal mengupdate produk' })
      }
    }
    if (method === 'DELETE') {
      await prisma.product.update({ where: { id }, data: { isActive: false } })
      return res.json({ message: 'Produk dihapus' })
    }
  }

  // Transactions
  if (path === '/api/transactions' && method === 'GET') {
    const user = verifyToken(req, res); if (!user) return
    const { from, to, page = 1 } = query
    const where = {}
    if (from && to) where.createdAt = { gte: new Date(from), lte: new Date(to) }
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, include: { cashier: { select: { name: true } }, items: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 20, skip: (Number(page) - 1) * 20 }),
      prisma.transaction.count({ where }),
    ])
    return res.json({ transactions, total, page: Number(page), totalPages: Math.ceil(total / 20) })
  }
  if (path === '/api/transactions' && method === 'POST') {
    const user = verifyToken(req, res); if (!user) return
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
        for (const item of items) await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } })
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

  // Admin - Dashboard
  if (path === '/api/admin/dashboard' && method === 'GET') {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (6 - i)); return d })
    const [todayTx, monthTx, totalProducts, recentTx, weeklyRaw, topProducts] = await Promise.all([
      prisma.transaction.aggregate({ where: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
      prisma.transaction.aggregate({ where: { createdAt: { gte: thisMonth }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.transaction.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { cashier: { select: { name: true } } } }),
      prisma.transaction.groupBy({ by: ['createdAt'], where: { createdAt: { gte: days[0] }, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
      prisma.orderItem.groupBy({ by: ['productId'], _sum: { qty: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 5 }),
    ])
    const chartData = days.map((d) => {
      const dayEnd = new Date(d); dayEnd.setDate(dayEnd.getDate() + 1)
      const dayTx = weeklyRaw.filter((t) => new Date(t.createdAt) >= d && new Date(t.createdAt) < dayEnd)
      return { label: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }), revenue: dayTx.reduce((s, t) => s + (t._sum.total || 0), 0), count: dayTx.reduce((s, t) => s + t._count, 0) }
    })
    const productNames = await prisma.product.findMany({ where: { id: { in: topProducts.map((p) => p.productId) } }, select: { id: true, name: true } })
    return res.json({
      today: { revenue: todayTx._sum.total || 0, transactions: todayTx._count },
      month: { revenue: monthTx._sum.total || 0, transactions: monthTx._count },
      totalProducts, recentTransactions: recentTx, chartData,
      topProducts: topProducts.map((p) => ({ name: productNames.find((n) => n.id === p.productId)?.name || 'Unknown', qty: p._sum.qty || 0, revenue: p._sum.subtotal || 0 })),
    })
  }

  // Admin - Categories
  if (path === '/api/admin/categories' && method === 'GET') {
    const user = verifyToken(req, res); if (!user) return
    const cats = await prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } }, products: { where: { isActive: true }, select: { id: true } } } })
    return res.json(cats.map((c) => ({ ...c, activeCount: c.products.length, products: undefined })))
  }
  if (path === '/api/admin/categories' && method === 'POST') {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    try {
      const cat = await prisma.category.create({ data: { name: req.body.name } })
      return res.status(201).json(cat)
    } catch (e) {
      if (e.code === 'P2002') return res.status(400).json({ message: 'Nama kategori sudah digunakan' })
      return res.status(500).json({ message: 'Gagal membuat kategori' })
    }
  }
  const catMatch = path.match(/^\/api\/admin\/categories\/([^/]+)$/)
  if (catMatch) {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    const id = catMatch[1]
    if (method === 'PUT') {
      try { return res.json(await prisma.category.update({ where: { id }, data: { name: req.body.name } })) }
      catch (e) { if (e.code === 'P2002') return res.status(400).json({ message: 'Nama kategori sudah digunakan' }); return res.status(500).json({ message: 'Gagal' }) }
    }
    if (method === 'DELETE') {
      const activeCount = await prisma.product.count({ where: { categoryId: id, isActive: true } })
      if (activeCount > 0) return res.status(400).json({ message: `Kategori masih digunakan oleh ${activeCount} produk aktif` })
      await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } })
      await prisma.category.delete({ where: { id } })
      return res.json({ message: 'Kategori dihapus' })
    }
  }

  // Admin - Users
  if (path === '/api/admin/users' && method === 'GET') {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    return res.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } }))
  }
  if (path === '/api/admin/users' && method === 'POST') {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    const { name, email, password, role } = req.body
    const hashed = await bcrypt.hash(password, 10)
    const newUser = await prisma.user.create({ data: { name, email, password: hashed, role } })
    return res.status(201).json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role })
  }
  const userMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/)
  if (userMatch) {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    if (method === 'PUT') {
      const { name, email, role, isActive, password } = req.body
      const data = { name, email, role, isActive }
      if (password) data.password = await bcrypt.hash(password, 10)
      return res.json(await prisma.user.update({ where: { id: userMatch[1] }, data, select: { id: true, name: true, email: true, role: true, isActive: true } }))
    }
  }

  // Admin - Ingredients
  if (path === '/api/admin/ingredients' && method === 'GET') {
    const user = verifyToken(req, res); if (!user) return
    return res.json(await prisma.ingredient.findMany({ orderBy: { name: 'asc' } }))
  }
  if (path === '/api/admin/ingredients' && method === 'POST') {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    const { name, unit, code } = req.body
    return res.status(201).json(await prisma.ingredient.create({ data: { name, unit, code: code || null } }))
  }
  const ingMatch = path.match(/^\/api\/admin\/ingredients\/([^/]+)$/)
  if (ingMatch) {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    const id = ingMatch[1]
    if (method === 'PUT') return res.json(await prisma.ingredient.update({ where: { id }, data: { name: req.body.name, unit: req.body.unit, code: req.body.code || null } }))
    if (method === 'DELETE') { await prisma.ingredient.delete({ where: { id } }); return res.json({ message: 'Bahan baku dihapus' }) }
  }

  // Admin - Ingredient Usage
  if (path === '/api/admin/ingredient-usage' && method === 'GET') {
    const user = verifyToken(req, res); if (!user) return
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
    const { from, to } = query
    const transactionWhere = { status: 'COMPLETED' }
    if (from && to) transactionWhere.createdAt = { gte: new Date(from), lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }
    const orderItems = await prisma.orderItem.findMany({ where: { transaction: transactionWhere }, include: { product: { include: { ingredients: { include: { ingredient: true } } } } } })
    const usageMap = {}
    for (const oi of orderItems) {
      for (const pi of oi.product.ingredients) {
        if (!usageMap[pi.ingredientId]) usageMap[pi.ingredientId] = { ingredientId: pi.ingredientId, name: pi.ingredient.name, unit: pi.ingredient.unit, totalQty: 0 }
        usageMap[pi.ingredientId].totalQty += pi.qty * oi.qty
      }
    }
    return res.json(Object.values(usageMap).sort((a, b) => b.totalQty - a.totalQty))
  }

  res.status(404).json({ message: 'Not found' })
}
