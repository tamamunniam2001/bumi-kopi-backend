const router = require('express').Router()
const { auth } = require('../middleware/auth')
const { create, getAll, getById } = require('../controllers/transactionController')

router.post('/', auth, create)
router.get('/', auth, getAll)
router.get('/:id', auth, getById)

module.exports = router
