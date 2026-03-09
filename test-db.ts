
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst();
    console.log('User status:', user?.status);
    console.log('Successfully queried User table');
  } catch (error) {
    console.error('Error querying User table:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
