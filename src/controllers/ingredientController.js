const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')
const prisma = new PrismaClient()

// ── Bahan Baku CRUD ──
async function getAll(req, res) {
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: 'asc' } })
  res.json(ingredients)
}

async function create(req, res) {
  const { name, unit, code } = req.body
  const ingredient = await prisma.ingredient.create({ data: { name, unit, code: code || null } })
  res.status(201).json(ingredient)
}

async function update(req, res) {
  const ingredient = await prisma.ingredient.update({
    where: { id: req.params.id },
    data: { name: req.body.name, unit: req.body.unit, code: req.body.code || null },
  })
  res.json(ingredient)
}

async function remove(req, res) {
  await prisma.ingredient.delete({ where: { id: req.params.id } })
  res.json({ message: 'Bahan baku dihapus' })
}

// ── Bahan Baku per Produk ──
async function getByProduct(req, res) {
  const items = await prisma.productIngredient.findMany({
    where: { productId: req.params.productId },
    include: { ingredient: true },
  })
  res.json(items)
}

async function upsertProductIngredient(req, res) {
  const { productId } = req.params
  const { ingredientId, qty } = req.body
  const item = await prisma.productIngredient.upsert({
    where: { productId_ingredientId: { productId, ingredientId } },
    update: { qty },
    create: { productId, ingredientId, qty },
    include: { ingredient: true },
  })
  res.json(item)
}

async function removeProductIngredient(req, res) {
  await prisma.productIngredient.delete({ where: { id: req.params.id } })
  res.json({ message: 'Bahan dihapus dari produk' })
}

// ── Rekap Bahan Baku Terpakai ──
async function getUsageReport(req, res) {
  try {
    const { from, to } = req.query
    const transactionWhere = { status: 'COMPLETED' }
    if (from && to) {
      transactionWhere.createdAt = {
        gte: new Date(from),
        lte: new Date(new Date(to).setHours(23, 59, 59, 999)),
      }
    }

    const orderItems = await prisma.orderItem.findMany({
      where: { transaction: transactionWhere },
      include: {
        product: {
          include: { ingredients: { include: { ingredient: true } } },
        },
      },
    })

    const usageMap = {}
    for (const oi of orderItems) {
      for (const pi of oi.product.ingredients) {
        const key = pi.ingredientId
        if (!usageMap[key]) {
          usageMap[key] = {
            ingredientId: key,
            name: pi.ingredient.name,
            unit: pi.ingredient.unit,
            totalQty: 0,
          }
        }
        usageMap[key].totalQty += pi.qty * oi.qty
      }
    }

    res.json(Object.values(usageMap).sort((a, b) => b.totalQty - a.totalQty))
  } catch (e) {
    res.status(500).json({ message: 'Gagal memuat rekap bahan', detail: e.message })
  }
}

// ── Bulk Import dari Excel ──
async function bulkImport(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' })

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

    if (!rows.length) return res.status(400).json({ message: 'File kosong' })

    const results = { created: 0, updated: 0, skipped: 0, errors: [] }

    for (const row of rows) {
      const name = (row['Nama Bahan'] || row['name'] || '').toString().trim()
      const unit = (row['Satuan'] || row['unit'] || '').toString().trim()
      const code = (row['Kode'] || row['code'] || '').toString().trim() || null

      if (!name || !unit) {
        results.errors.push(`Baris dilewati: nama atau satuan kosong (${JSON.stringify(row)})`)
        results.skipped++
        continue
      }

      try {
        const existing = await prisma.ingredient.findFirst({ where: { name } })
        if (existing) {
          await prisma.ingredient.update({ where: { id: existing.id }, data: { unit, code } })
          results.updated++
        } else {
          await prisma.ingredient.create({ data: { name, unit, code } })
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

module.exports = { getAll, create, update, remove, getByProduct, upsertProductIngredient, removeProductIngredient, getUsageReport, bulkImport }
