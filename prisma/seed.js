const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10)
  const cashierPassword = await bcrypt.hash('kasir123', 10)

  await prisma.user.upsert({
    where: { email: 'admin@bumikopi.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@bumikopi.com', password: adminPassword, role: 'ADMIN' },
  })

  await prisma.user.upsert({
    where: { email: 'kasir@bumikopi.com' },
    update: {},
    create: { name: 'Kasir 1', email: 'kasir@bumikopi.com', password: cashierPassword, role: 'CASHIER' },
  })

  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: 'Kopi' }, update: {}, create: { name: 'Kopi' } }),
    prisma.category.upsert({ where: { name: 'Non-Kopi' }, update: {}, create: { name: 'Non-Kopi' } }),
    prisma.category.upsert({ where: { name: 'Makanan' }, update: {}, create: { name: 'Makanan' } }),
  ])

  const products = [
    { name: 'Espresso', price: 18000, stock: 100, categoryId: categories[0].id },
    { name: 'Americano', price: 22000, stock: 100, categoryId: categories[0].id },
    { name: 'Cappuccino', price: 28000, stock: 100, categoryId: categories[0].id },
    { name: 'Latte', price: 30000, stock: 100, categoryId: categories[0].id },
    { name: 'V60', price: 32000, stock: 100, categoryId: categories[0].id },
    { name: 'Matcha Latte', price: 28000, stock: 100, categoryId: categories[1].id },
    { name: 'Coklat Panas', price: 25000, stock: 100, categoryId: categories[1].id },
    { name: 'Croissant', price: 22000, stock: 50, categoryId: categories[2].id },
    { name: 'Roti Bakar', price: 18000, stock: 50, categoryId: categories[2].id },
  ]

  for (const p of products) {
    await prisma.product.create({ data: p })
  }

  console.log('✅ Seed selesai')
}

main().catch(console.error).finally(() => prisma.$disconnect())
