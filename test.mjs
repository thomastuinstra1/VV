import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['query', 'error'] });

async function main() {
  try {
    const accounts = await prisma.account.findMany();
    console.log("Accounts fetched:", accounts);
  } catch (e) {
    console.error("Prisma fetch error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();