const prisma = require('../../../lib/prisma')
const { handleCors, verifyToken } = require('../../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return
  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })

  const { id } = req.query

  if (req.method === 'PUT') {
    try {
      const { code, name, price, stock, imageUrl, categoryId } = req.body
      const product = await prisma.product.update({ where: { id }, data: { code: code || null, name, price, stock, imageUrl: imageUrl || null, categoryId } })
      return res.json(product)
    } catch (e) {
      if (e.code === 'P2002') return res.status(400).json({ message: 'Kode produk sudah digunakan' })
      return res.status(500).json({ message: 'Gagal mengupdate produk' })
    }
  }

  if (req.method === 'DELETE') {
    await prisma.product.update({ where: { id }, data: { isActive: false } })
    return res.json({ message: 'Produk dihapus' })
  }

  res.status(405).end()
}
