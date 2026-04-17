import bcrypt from "bcryptjs";
import {
  CollectionStatus,
  CustomerStatus,
  DeliveryStatus,
  PaymentMode,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  const now = new Date();
  const currentMonth = monthKey(now);

  const [agentPass, boyPass, adminPass, userPass] = await Promise.all([
    bcrypt.hash("agent@db123", 10),
    bcrypt.hash("boy123", 10),
    bcrypt.hash("admin123", 10),
    bcrypt.hash("user123", 10),
  ]);

  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: { unitCost: 5 },
    create: { id: "default", unitCost: 5 },
  });

  await prisma.user.upsert({
    where: { username: "agent1" },
    update: {
      username: "agent1",
      email: "agent1@example.com",
      passwordHash: agentPass,
      role: "AGENT",
      approvalStatus: "APPROVED",
    },
    create: {
      username: "agent1",
      email: "agent1@example.com",
      passwordHash: agentPass,
      role: "AGENT",
      approvalStatus: "APPROVED",
    },
  } as any);

  const deliveryBoy = await prisma.user.upsert({
    where: { username: "boy1" },
    update: {
      email: "boy1@example.com",
      passwordHash: boyPass,
      role: "DELIVERY_BOY",
      approvalStatus: "APPROVED",
    },
    create: {
      username: "boy1",
      email: "boy1@example.com",
      passwordHash: boyPass,
      role: "DELIVERY_BOY",
      approvalStatus: "APPROVED",
    },
  } as any);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      email: "admin@example.com",
      passwordHash: adminPass,
      role: "ADMIN",
      approvalStatus: "APPROVED",
    },
    create: {
      username: "admin",
      email: "admin@example.com",
      passwordHash: adminPass,
      role: "ADMIN",
      approvalStatus: "APPROVED",
    },
  } as any);

  await prisma.user.upsert({
    where: { username: "user1@example.com" },
    update: {
      email: "user1@example.com",
      passwordHash: userPass,
      role: "USER",
      approvalStatus: "APPROVED",
    },
    create: {
      username: "user1@example.com",
      email: "user1@example.com",
      passwordHash: userPass,
      role: "USER",
      approvalStatus: "APPROVED",
    },
  } as any);

  const customerA = await prisma.customer.upsert({
    where: { id: "seed-c1" },
    update: { name: "Ravi Kumar", area: "North Street", status: CustomerStatus.ACTIVE },
    create: { id: "seed-c1", name: "Ravi Kumar", area: "North Street", status: CustomerStatus.ACTIVE },
  });

  const customerB = await prisma.customer.upsert({
    where: { id: "seed-c2" },
    update: { name: "Anita Devi", area: "Market Road", status: CustomerStatus.ACTIVE },
    create: { id: "seed-c2", name: "Anita Devi", area: "Market Road", status: CustomerStatus.ACTIVE },
  });

  await prisma.delivery.upsert({
    where: { id: "seed-d1" },
    update: {
      customerId: customerA.id,
      date: now,
      ordered: 30,
      delivered: 30,
      deliveryBoyId: deliveryBoy.id,
      status: DeliveryStatus.DELIVERED,
    },
    create: {
      id: "seed-d1",
      customerId: customerA.id,
      date: now,
      ordered: 30,
      delivered: 30,
      deliveryBoyId: deliveryBoy.id,
      status: DeliveryStatus.DELIVERED,
    },
  });

  await prisma.delivery.upsert({
    where: { id: "seed-d2" },
    update: {
      customerId: customerB.id,
      date: now,
      ordered: 30,
      delivered: 27,
      deliveryBoyId: deliveryBoy.id,
      status: DeliveryStatus.DELIVERED,
    },
    create: {
      id: "seed-d2",
      customerId: customerB.id,
      date: now,
      ordered: 30,
      delivered: 27,
      deliveryBoyId: deliveryBoy.id,
      status: DeliveryStatus.DELIVERED,
    },
  });

  await prisma.collection.upsert({
    where: { id: "seed-p1" },
    update: {
      customerId: customerA.id,
      monthYear: currentMonth,
      amount: 450,
      paymentDate: new Date(`${currentMonth}-07T00:00:00.000Z`),
      mode: PaymentMode.ONLINE,
      status: CollectionStatus.PAID,
      dueDate: null,
    },
    create: {
      id: "seed-p1",
      customerId: customerA.id,
      monthYear: currentMonth,
      amount: 450,
      paymentDate: new Date(`${currentMonth}-07T00:00:00.000Z`),
      mode: PaymentMode.ONLINE,
      status: CollectionStatus.PAID,
      dueDate: null,
    },
  });

  await prisma.collection.upsert({
    where: { id: "seed-p2" },
    update: {
      customerId: customerB.id,
      monthYear: currentMonth,
      amount: 420,
      paymentDate: null,
      dueDate: new Date(`${currentMonth}-10T00:00:00.000Z`),
      mode: PaymentMode.CASH,
      status: CollectionStatus.PENDING,
    },
    create: {
      id: "seed-p2",
      customerId: customerB.id,
      monthYear: currentMonth,
      amount: 420,
      paymentDate: null,
      dueDate: new Date(`${currentMonth}-10T00:00:00.000Z`),
      mode: PaymentMode.CASH,
      status: CollectionStatus.PENDING,
    },
  });

  await prisma.salary.upsert({
    where: { id: "seed-s1" },
    update: {
      deliveryBoyId: deliveryBoy.id,
      monthYear: currentMonth,
      amount: 300,
    },
    create: {
      id: "seed-s1",
      deliveryBoyId: deliveryBoy.id,
      monthYear: currentMonth,
      amount: 300,
    },
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
