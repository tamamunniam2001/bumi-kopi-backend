const prisma = require('../../../../lib/prisma')
const { handleCors, verifyToken } = require('../../../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return
  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })

  const { id } = req.query

  if (req.method === 'PUT') {
    try {
      const cat = await prisma.category.update({ where: { id }, data: { name: req.body.name } })
      return res.json(cat)
    } catch (e) {
      if (e.code === 'P2002') return res.status(400).json({ message: 'Nama kategori sudah digunakan' })
      return res.status(500).json({ message: 'Gagal mengupdate kategori' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const activeCount = await prisma.product.count({ where: { categoryId: id, isActive: true } })
      if (activeCount > 0) return res.status(400).json({ message: `Kategori masih digunakan oleh ${activeCount} produk aktif` })
      await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } })
      await prisma.category.delete({ where: { id } })
      return res.json({ message: 'Kategori dihapus' })
    } catch (e) {
      return res.status(500).json({ message: 'Gagal menghapus kategori' })
    }
  }

  res.status(405).end()
}
