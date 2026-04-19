const router = require('express').Router()
const { auth, adminOnly } = require('../middleware/auth')
const { getAll, create, update, remove, bulkImport } = require('../controllers/productController')
const { getByProduct, upsertProductIngredient, removeProductIngredient } = require('../controllers/ingredientController')
const multer = require('multer')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.get('/', auth, getAll)
router.post('/', auth, adminOnly, create)
router.post('/bulk-import', auth, adminOnly, upload.single('file'), bulkImport)
router.put('/:id', auth, adminOnly, update)
router.delete('/:id', auth, adminOnly, remove)

// Bahan baku per produk
router.get('/:productId/ingredients', auth, getByProduct)
router.post('/:productId/ingredients', auth, adminOnly, upsertProductIngredient)
router.delete('/:productId/ingredients/:id', auth, adminOnly, removeProductIngredient)

module.exports = router
