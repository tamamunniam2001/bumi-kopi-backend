const router = require('express').Router()
const { auth, adminOnly } = require('../middleware/auth')
const { getDashboard } = require('../controllers/dashboardController')
const { getAll: getUsers, create: createUser, update: updateUser } = require('../controllers/userController')
const { getAll: getIngredients, create: createIngredient, update: updateIngredient, remove: removeIngredient, getUsageReport, bulkImport } = require('../controllers/ingredientController')
const { PrismaClient } = require('@prisma/client')
const multer = require('multer')

const prisma = new PrismaClient()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.get('/dashboard', auth, adminOnly, getDashboard)
router.get('/categories', auth, async (req, res) => {
  const cats = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: true } },
      products: { where: { isActive: true }, select: { id: true } }
    }
  })
  res.json(cats.map((c) => ({ ...c, activeCount: c.products.length, products: undefined })))
})
router.post('/categories', auth, adminOnly, async (req, res) => {
  try {
    const cat = await prisma.category.create({ data: { name: req.body.name } })
    res.status(201).json(cat)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ message: 'Nama kategori sudah digunakan' })
    res.status(500).json({ message: 'Gagal membuat kategori' })
  }
})
router.put('/categories/:id', auth, adminOnly, async (req, res) => {
  try {
    const cat = await prisma.category.update({ where: { id: req.params.id }, data: { name: req.body.name } })
    res.json(cat)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ message: 'Nama kategori sudah digunakan' })
    res.status(500).json({ message: 'Gagal mengupdate kategori' })
  }
})
router.delete('/categories/:id', auth, adminOnly, async (req, res) => {
  try {
    const activeCount = await prisma.product.count({ where: { categoryId: req.params.id, isActive: true } })
    if (activeCount > 0) return res.status(400).json({ message: `Kategori masih digunakan oleh ${activeCount} produk aktif` })
    await prisma.product.updateMany({ where: { categoryId: req.params.id }, data: { categoryId: null } })
    await prisma.category.delete({ where: { id: req.params.id } })
    res.json({ message: 'Kategori dihapus' })
  } catch (e) {
    console.error('Delete category error:', e.message)
    res.status(500).json({ message: 'Gagal menghapus kategori', detail: e.message })
  }
})
router.get('/users', auth, adminOnly, getUsers)
router.post('/users', auth, adminOnly, createUser)
router.put('/users/:id', auth, adminOnly, updateUser)

// Bahan baku
router.get('/ingredients', auth, getIngredients)
router.post('/ingredients', auth, adminOnly, createIngredient)
router.put('/ingredients/:id', auth, adminOnly, updateIngredient)
router.delete('/ingredients/:id', auth, adminOnly, removeIngredient)
router.post('/ingredients/bulk-import', auth, adminOnly, upload.single('file'), bulkImport)

// Rekap bahan baku terpakai
router.get('/ingredient-usage', auth, adminOnly, getUsageReport)

module.exports = router
