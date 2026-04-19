const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function getAll(req, res) {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } })
  res.json(users)
}

async function create(req, res) {
  const { name, email, password, role } = req.body
  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { name, email, password: hashed, role } })
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role })
}

async function update(req, res) {
  const { name, email, role, isActive, password } = req.body
  const data = { name, email, role, isActive }
  if (password) data.password = await bcrypt.hash(password, 10)
  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: { id: true, name: true, email: true, role: true, isActive: true } })
  res.json(user)
}

module.exports = { getAll, create, update }
