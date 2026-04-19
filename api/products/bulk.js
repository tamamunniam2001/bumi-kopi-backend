const prisma = require('../../../lib/prisma')
const { handleCors, verifyToken } = require('../../../lib/helpers')

module.exports = async (req, res) => {
  if (handleCors(req, res)) return
  const user = verifyToken(req, res)
  if (!user) return
  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Akses ditolak' })
  if (req.method !== 'POST') return res.status(405).end()

  const { products: rows } = req.body
  if (!rows || !rows.length) return res.status(400).json({ message: 'Data kosong' })

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
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data: { code: code || null, price, stock, categoryId, imageUrl: imageUrl || null } })
        results.updated++
      } else {
        await prisma.product.create({ data: { code: code || null, name, price, stock, categoryId, imageUrl: imageUrl || null } })
        results.created++
      }
    } catch (e) {
      results.errors.push(`Gagal: ${name} - ${e.message}`); results.skipped++
    }
  }

  res.json(results)
}
