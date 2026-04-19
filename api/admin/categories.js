const prisma = require('../../../lib/prisma')
const { handleCors, verifyToken } = require('../../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const cats = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } }, products: { where: { isActive: true }, select: { id: true } } },
    })
    return res.json(cats.map((c) => ({ ...c, activeCount: c.products.length, products: undefined })))
  }

  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })

  if (req.method === 'POST') {
    try {
      const cat = await prisma.category.create({ data: { name: req.body.name } })
      return res.status(201).json(cat)
    } catch (e) {
      if (e.code === 'P2002') return res.status(400).json({ message: 'Nama kategori sudah digunakan' })
      return res.status(500).json({ message: 'Gagal membuat kategori' })
    }
  }

  res.status(405).end()
}
