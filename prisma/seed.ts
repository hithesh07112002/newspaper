import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: { unitCost: 5 },
    create: { id: "default", unitCost: 5 },
  });

  console.log("Seed complete: baseline app settings initialized.");
  console.log("No demo users, credentials, or ledger records were inserted.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
