import {
  CollectionStatus,
  CustomerStatus,
  DeliveryStatus,
  PaymentMode,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db";
import { calculateMetrics } from "@/lib/calculations";
import type { Collection, Customer, Delivery, LedgerData, Salary, User } from "@/lib/types";

export type DashboardViewer = {
  userId: string;
  username: string;
  role: User["role"];
};

function toIsoDateOnly(value: Date | null | undefined) {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

function mapRole(role: UserRole): User["role"] {
  return role;
}

function mapCustomerStatus(status: CustomerStatus): Customer["status"] {
  return status;
}

function mapDeliveryStatus(status: DeliveryStatus): Delivery["status"] {
  return status;
}

function mapCollectionStatus(status: CollectionStatus): Collection["status"] {
  return status;
}

function mapPaymentMode(mode: PaymentMode): Collection["mode"] {
  return mode;
}

function mapUser(item: {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  approvalStatus: User["approvalStatus"];
}): User {
  return {
    id: item.id,
    username: item.username,
    email: item.email ?? undefined,
    role: mapRole(item.role),
    approvalStatus: item.approvalStatus,
  };
}

function mapCustomer(item: {
  id: string;
  name: string;
  area: string;
  status: CustomerStatus;
  assignedUserId: string | null;
  assignedUser: { username: string } | null;
}): Customer {
  return {
    id: item.id,
    name: item.name,
    area: item.area,
    status: mapCustomerStatus(item.status),
    assignedUserId: item.assignedUserId ?? undefined,
    assignedUsername: item.assignedUser?.username ?? undefined,
  };
}

function mapDelivery(item: {
  id: string;
  customerId: string;
  date: Date;
  ordered: number;
  delivered: number;
  status: DeliveryStatus;
  deliveryBoy: { username: string };
}): Delivery {
  return {
    id: item.id,
    customerId: item.customerId,
    date: item.date.toISOString(),
    ordered: item.ordered,
    delivered: item.delivered,
    deliveryBoy: item.deliveryBoy.username,
    status: mapDeliveryStatus(item.status),
  };
}

function mapCollection(item: {
  id: string;
  customerId: string;
  monthYear: string;
  amount: number;
  paymentDate: Date | null;
  dueDate: Date | null;
  mode: PaymentMode;
  status: CollectionStatus;
}): Collection {
  return {
    id: item.id,
    customerId: item.customerId,
    monthYear: item.monthYear,
    amount: item.amount,
    paymentDate: toIsoDateOnly(item.paymentDate),
    dueDate: toIsoDateOnly(item.dueDate) || undefined,
    mode: mapPaymentMode(item.mode),
    status: mapCollectionStatus(item.status),
  };
}

function mapSalary(item: {
  id: string;
  monthYear: string;
  amount: number;
  deliveryBoy: { username: string };
}): Salary {
  return {
    id: item.id,
    deliveryBoy: item.deliveryBoy.username,
    monthYear: item.monthYear,
    amount: item.amount,
  };
}

function getMonthDateRange(monthYear: string) {
  const [yearPart, monthPart] = monthYear.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;

  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));

  return { start, end };
}

async function getAdminOrAgentLedgerData(monthYear: string): Promise<LedgerData> {
  const { start, end } = getMonthDateRange(monthYear);

  const [users, customers, deliveries, collections, salaries, settings] = await Promise.all([
    db.user.findMany({
      where: {
        role: "DELIVERY_BOY",
        approvalStatus: "APPROVED",
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        approvalStatus: true,
      },
    }),
    db.customer.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        area: true,
        status: true,
        assignedUserId: true,
        assignedUser: {
          select: {
            username: true,
          },
        },
      },
    }),
    db.delivery.findMany({
      where: {
        date: {
          gte: start,
          lt: end,
        },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        customerId: true,
        date: true,
        ordered: true,
        delivered: true,
        status: true,
        deliveryBoy: {
          select: {
            username: true,
          },
        },
      },
    }),
    db.collection.findMany({
      where: { monthYear },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        customerId: true,
        monthYear: true,
        amount: true,
        paymentDate: true,
        dueDate: true,
        mode: true,
        status: true,
      },
    }),
    db.salary.findMany({
      where: { monthYear },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        monthYear: true,
        amount: true,
        deliveryBoy: {
          select: {
            username: true,
          },
        },
      },
    }),
    db.appSetting.findUnique({ where: { id: "default" } }),
  ]);

  const mappedUsers: User[] = users.map(mapUser);
  const mappedCustomers: Customer[] = customers.map(mapCustomer);
  const mappedDeliveries: Delivery[] = deliveries.map(mapDelivery);
  const mappedCollections: Collection[] = collections.map(mapCollection);
  const mappedSalaries: Salary[] = salaries.map(mapSalary);

  return {
    users: mappedUsers,
    customers: mappedCustomers,
    deliveries: mappedDeliveries,
    collections: mappedCollections,
    salaries: mappedSalaries,
    unitCost: settings?.unitCost ?? 5,
  };
}

async function getDeliveryBoyLedgerData(
  monthYear: string,
  viewer: DashboardViewer,
): Promise<LedgerData> {
  const { start, end } = getMonthDateRange(monthYear);

  const [viewerUser, deliveries, settings] = await Promise.all([
    db.user.findUnique({
      where: { id: viewer.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        approvalStatus: true,
      },
    }),
    db.delivery.findMany({
      where: {
        date: {
          gte: start,
          lt: end,
        },
        deliveryBoyId: viewer.userId,
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        customerId: true,
        date: true,
        ordered: true,
        delivered: true,
        status: true,
        deliveryBoy: {
          select: {
            username: true,
          },
        },
      },
    }),
    db.appSetting.findUnique({ where: { id: "default" } }),
  ]);

  const customerIds = Array.from(new Set(deliveries.map((entry) => entry.customerId)));

  const [customers, collections, salaries] = await Promise.all([
    customerIds.length > 0
      ? db.customer.findMany({
          where: {
            id: {
              in: customerIds,
            },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            area: true,
            status: true,
            assignedUserId: true,
            assignedUser: {
              select: {
                username: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    customerIds.length > 0
      ? db.collection.findMany({
          where: {
            monthYear,
            customerId: {
              in: customerIds,
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            customerId: true,
            monthYear: true,
            amount: true,
            paymentDate: true,
            dueDate: true,
            mode: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    db.salary.findMany({
      where: {
        monthYear,
        deliveryBoyId: viewer.userId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        monthYear: true,
        amount: true,
        deliveryBoy: {
          select: {
            username: true,
          },
        },
      },
    }),
  ]);

  const users: User[] = viewerUser ? [mapUser(viewerUser)] : [];

  return {
    users,
    customers: customers.map(mapCustomer),
    deliveries: deliveries.map(mapDelivery),
    collections: collections.map(mapCollection),
    salaries: salaries.map(mapSalary),
    unitCost: settings?.unitCost ?? 5,
  };
}

async function getUserLedgerData(monthYear: string, viewer: DashboardViewer): Promise<LedgerData> {
  const { start, end } = getMonthDateRange(monthYear);

  const [viewerUser, customers, settings] = await Promise.all([
    db.user.findUnique({
      where: { id: viewer.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        approvalStatus: true,
      },
    }),
    db.customer.findMany({
      where: { assignedUserId: viewer.userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        area: true,
        status: true,
        assignedUserId: true,
        assignedUser: {
          select: {
            username: true,
          },
        },
      },
    }),
    db.appSetting.findUnique({ where: { id: "default" } }),
  ]);

  const customerIds = customers.map((entry) => entry.id);

  const [deliveries, collections] = await Promise.all([
    customerIds.length > 0
      ? db.delivery.findMany({
          where: {
            date: {
              gte: start,
              lt: end,
            },
            customerId: {
              in: customerIds,
            },
          },
          orderBy: { date: "desc" },
          select: {
            id: true,
            customerId: true,
            date: true,
            ordered: true,
            delivered: true,
            status: true,
            deliveryBoyId: true,
            deliveryBoy: {
              select: {
                username: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    customerIds.length > 0
      ? db.collection.findMany({
          where: {
            monthYear,
            customerId: {
              in: customerIds,
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            customerId: true,
            monthYear: true,
            amount: true,
            paymentDate: true,
            dueDate: true,
            mode: true,
            status: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const deliveryBoyIds = Array.from(new Set(deliveries.map((entry) => entry.deliveryBoyId)));

  const [deliveryUsers, salaries] = await Promise.all([
    deliveryBoyIds.length > 0
      ? db.user.findMany({
          where: {
            id: {
              in: deliveryBoyIds,
            },
          },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            approvalStatus: true,
          },
        })
      : Promise.resolve([]),
    deliveryBoyIds.length > 0
      ? db.salary.findMany({
          where: {
            monthYear,
            deliveryBoyId: {
              in: deliveryBoyIds,
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            monthYear: true,
            amount: true,
            deliveryBoy: {
              select: {
                username: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const users: User[] = [];
  if (viewerUser) {
    users.push(mapUser(viewerUser));
  }
  for (const user of deliveryUsers) {
    if (!users.some((entry) => entry.id === user.id)) {
      users.push(mapUser(user));
    }
  }

  return {
    users,
    customers: customers.map(mapCustomer),
    deliveries: deliveries.map(mapDelivery),
    collections: collections.map(mapCollection),
    salaries: salaries.map(mapSalary),
    unitCost: settings?.unitCost ?? 5,
  };
}

export async function getLedgerData(monthYear: string, viewer?: DashboardViewer): Promise<LedgerData> {
  if (!viewer || viewer.role === "AGENT" || viewer.role === "ADMIN") {
    return getAdminOrAgentLedgerData(monthYear);
  }

  if (viewer.role === "DELIVERY_BOY") {
    return getDeliveryBoyLedgerData(monthYear, viewer);
  }

  if (viewer.role === "USER") {
    return getUserLedgerData(monthYear, viewer);
  }

  return {
    users: [],
    customers: [],
    deliveries: [],
    collections: [],
    salaries: [],
    unitCost: 5,
  };
}

export async function getDashboardPayload(monthYear: string, viewer?: DashboardViewer) {
  const data = await getLedgerData(monthYear, viewer);
  const metrics = calculateMetrics(data, monthYear);
  const pendingCount = data.collections.filter((item) => item.status === "PENDING").length;

  return {
    monthYear,
    data,
    metrics,
    pendingCount,
  };
}
