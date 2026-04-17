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

export async function getLedgerData(monthYear: string): Promise<LedgerData> {
  const [users, customers, deliveries, collections, salaries, settings] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" } }),
    db.customer.findMany({ orderBy: { createdAt: "asc" } }),
    db.delivery.findMany({ include: { deliveryBoy: true }, orderBy: { createdAt: "desc" } }),
    db.collection.findMany({ where: { monthYear }, orderBy: { createdAt: "desc" } }),
    db.salary.findMany({ where: { monthYear }, include: { deliveryBoy: true }, orderBy: { createdAt: "desc" } }),
    db.appSetting.findUnique({ where: { id: "default" } }),
  ]);

  const mappedUsers: User[] = users.map((item) => {
    const user = item as unknown as {
      id: string;
      username: string;
      role: UserRole;
      email?: string | null;
      approvalStatus?: User["approvalStatus"];
    };

    return {
      id: user.id,
      username: user.username,
      email: user.email ?? undefined,
      role: mapRole(user.role),
      approvalStatus: user.approvalStatus,
    };
  });

  const mappedCustomers: Customer[] = customers.map((item) => ({
    id: item.id,
    name: item.name,
    area: item.area,
    status: mapCustomerStatus(item.status),
  }));

  const mappedDeliveries: Delivery[] = deliveries.map((item) => ({
    id: item.id,
    customerId: item.customerId,
    date: item.date.toISOString(),
    ordered: item.ordered,
    delivered: item.delivered,
    deliveryBoy: item.deliveryBoy.username,
    status: mapDeliveryStatus(item.status),
  }));

  const mappedCollections: Collection[] = collections.map((item) => ({
    id: item.id,
    customerId: item.customerId,
    monthYear: item.monthYear,
    amount: item.amount,
    paymentDate: toIsoDateOnly(item.paymentDate),
    dueDate: toIsoDateOnly(item.dueDate) || undefined,
    mode: mapPaymentMode(item.mode),
    status: mapCollectionStatus(item.status),
  }));

  const mappedSalaries: Salary[] = salaries.map((item) => ({
    id: item.id,
    deliveryBoy: item.deliveryBoy.username,
    monthYear: item.monthYear,
    amount: item.amount,
  }));

  return {
    users: mappedUsers,
    customers: mappedCustomers,
    deliveries: mappedDeliveries,
    collections: mappedCollections,
    salaries: mappedSalaries,
    unitCost: settings?.unitCost ?? 5,
  };
}

export async function getDashboardPayload(monthYear: string) {
  const data = await getLedgerData(monthYear);
  const metrics = calculateMetrics(data, monthYear);
  const pendingCount = data.collections.filter((item) => item.status === "PENDING").length;

  return {
    monthYear,
    data,
    metrics,
    pendingCount,
  };
}
