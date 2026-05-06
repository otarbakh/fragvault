import 'dotenv/config';
import prisma from '../lib/prisma';

async function main(): Promise<void> {
  const result = await prisma.lobby.updateMany({
    where: { status: { in: ['OPEN', 'FULL'] } },
    data: { status: 'COMPLETED' },
  });
  console.log(`Reset ${result.count} lobbies to COMPLETED`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
