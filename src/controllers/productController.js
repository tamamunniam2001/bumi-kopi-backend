const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')
const prisma = new PrismaClient()

async function getAll(req, res) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true, ingredients: { include: { ingredient: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(products)
}

async function create(req, res) {
  try {
    const { code, name, price, stock, imageUrl, categoryId } = req.body
    const product = await prisma.product.create({ data: { code: code || null, name, price, stock, imageUrl: imageUrl || null, categoryId } })
    res.status(201).json(product)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ message: `Kode produk sudah digunakan` })
    res.status(500).json({ message: 'Gagal menyimpan produk', detail: e.message })
  }
}

async function update(req, res) {
  try {
    const { id } = req.params
    const { code, name, price, stock, imageUrl, categoryId } = req.body
    const product = await prisma.product.update({ where: { id }, data: { code: code || null, name, price, stock, imageUrl: imageUrl || null, categoryId } })
    res.json(product)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ message: `Kode produk sudah digunakan` })
    res.status(500).json({ message: 'Gagal mengupdate produk', detail: e.message })
  }
}

async function remove(req, res) {
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } })
  res.json({ message: 'Produk dihapus' })
}

async function bulkImport(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' })

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

    if (!rows.length) return res.status(400).json({ message: 'File kosong' })

    // Cache kategori
    const allCats = await prisma.category.findMany()
    const catMap = Object.fromEntries(allCats.map((c) => [c.name.toLowerCase(), c.id]))

    const results = { created: 0, updated: 0, skipped: 0, errors: [] }

    for (const row of rows) {
      const name  = (row['Nama Produk'] || row['name']  || '').toString().trim()
      const code  = (row['Kode']        || row['code']  || '').toString().trim() || null
      const price = Number(row['Harga'] || row['price'] || 0)
      const stock = Number(row['Stok']  || row['stock'] || 0)
      const catName = (row['Kategori']  || row['category'] || '').toString().trim()
      const imageUrl = (row['URL Gambar'] || row['imageUrl'] || '').toString().trim() || null

      if (!name || !price || !catName) {
        results.errors.push(`Dilewati: nama/harga/kategori kosong — "${name || '(kosong)'}"`)
        results.skipped++
        continue
      }

      const categoryId = catMap[catName.toLowerCase()]
      if (!categoryId) {
        results.errors.push(`Kategori "${catName}" tidak ditemukan — produk "${name}" dilewati`)
        results.skipped++
        continue
      }

      try {
        const existing = await prisma.product.findFirst({ where: { name } })
        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data: { code, price, stock, categoryId, imageUrl } })
          results.updated++
        } else {
          await prisma.product.create({ data: { code, name, price, stock, categoryId, imageUrl } })
          results.created++
        }
      } catch (e) {
        results.errors.push(`Gagal proses "${name}": ${e.message}`)
        results.skipped++
      }
    }

    res.json(results)
  } catch (e) {
    res.status(500).json({ message: 'Gagal membaca file', detail: e.message })
  }
}

module.exports = { getAll, create, update, remove, bulkImport }
