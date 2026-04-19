const prisma = require('../../lib/prisma')
const { handleCors, verifyToken } = require('../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, ingredients: { include: { ingredient: true } } },
      orderBy: { name: 'asc' },
    })
    return res.json(products)
  }

  if (req.method === 'POST') {
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

  res.status(405).end()
}
