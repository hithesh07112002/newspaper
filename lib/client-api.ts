import type { MonthlyMetrics } from "@/lib/calculations";
import type { Collection, LedgerData, PaymentMode, User } from "@/lib/types";

type DashboardResponse = {
  monthYear: string;
  data: LedgerData;
  metrics: MonthlyMetrics;
  pendingCount: number;
};

type LoginResponse = {
  user: User;
};

type RegisterResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    role: "USER" | "DELIVERY_BOY";
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  };
};

type MeResponse = {
  user: User;
};

type InsightResponse = {
  insight: string;
  source: "gemini" | "rule-based";
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function loginApi(username: string, password: string) {
  return requestJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: username, password }),
  });
}

export async function registerApi(input: {
  email: string;
  password: string;
  role: "USER" | "DELIVERY_BOY";
}) {
  return requestJson<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logoutApi() {
  return requestJson<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function meApi() {
  return requestJson<MeResponse>("/api/auth/me");
}

export async function dashboardApi(month: string) {
  return requestJson<DashboardResponse>(`/api/dashboard?month=${encodeURIComponent(month)}`);
}

export async function addCustomerApi(name: string, area: string) {
  return requestJson<{ id: string }>("/api/customers", {
    method: "POST",
    body: JSON.stringify({ name, area }),
  });
}

export async function updateCustomerStatusApi(customerId: string, status: "ACTIVE" | "STOPPED") {
  return requestJson<{ ok: boolean }>("/api/customers", {
    method: "PATCH",
    body: JSON.stringify({ customerId, status }),
  });
}

export async function recordCollectionApi(input: {
  customerId: string;
  monthYear: string;
  amount: number;
  mode: PaymentMode;
}) {
  return requestJson<{ id: string }>("/api/collections", {
    method: "POST",
    body: JSON.stringify({
      customerId: input.customerId,
      monthYear: input.monthYear,
      amount: input.amount,
      mode: input.mode,
      status: "PAID",
    }),
  });
}

export async function addDueApi(input: {
  customerId: string;
  monthYear: string;
  amount: number;
  dueDate?: string;
}) {
  return requestJson<{ id: string }>("/api/collections", {
    method: "POST",
    body: JSON.stringify({
      customerId: input.customerId,
      monthYear: input.monthYear,
      amount: input.amount,
      mode: "CASH",
      status: "PENDING",
      dueDate: input.dueDate,
    }),
  });
}

export async function markCollectionPaidApi(collectionId: string) {
  return requestJson<{ ok: boolean }>("/api/collections", {
    method: "PATCH",
    body: JSON.stringify({ collectionId }),
  });
}

export async function addDeliveryApi(input: {
  customerId: string;
  ordered: number;
  deliveryBoyUsername: string;
}) {
  return requestJson<{ id: string }>("/api/deliveries", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function confirmDeliveryApi(deliveryId: string, delivered: number) {
  return requestJson<{ ok: boolean }>("/api/deliveries", {
    method: "PATCH",
    body: JSON.stringify({ deliveryId, delivered }),
  });
}

export async function generateInsightApi(input: {
  monthKey: string;
  totalCollection: number;
  lossAmount: number;
  netProfit: number;
  pendingCount: number;
}) {
  return requestJson<InsightResponse>("/api/insights", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPendingCollections(collections: Collection[], monthYear: string) {
  return collections.filter((entry) => entry.status === "PENDING" && entry.monthYear === monthYear);
}

export async function getDeliveryBoyRegistrationsApi() {
  return requestJson<{
    deliveryBoys: Array<{
      id: string;
      email: string | null;
      username: string;
      approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
      createdAt: string;
    }>;
  }>("/api/auth/delivery-boys");
}

export async function reviewDeliveryBoyApi(userId: string, action: "APPROVE" | "REJECT") {
  return requestJson<{ ok: boolean }>("/api/auth/delivery-boys", {
    method: "PATCH",
    body: JSON.stringify({ userId, action }),
  });
}
