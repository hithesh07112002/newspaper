import type { MonthlyMetrics } from "@/lib/calculations";
import type { Collection, LedgerData, PaymentMode, User } from "@/lib/types";

type DashboardResponse = {
  monthYear: string;
  data: LedgerData;
  metrics: MonthlyMetrics;
  pendingCount: number;
  viewer: User;
};

type LoginResponse = {
  user: User;
};

type RegisterResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    role: "USER" | "AGENT" | "DELIVERY_BOY";
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

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

function withLeadingSlash(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function shouldIgnoreConfiguredBaseUrl(configuredUrl: string) {
  if (!configuredUrl || typeof window === "undefined") {
    return false;
  }

  try {
    const configuredHost = new URL(configuredUrl).hostname;
    const runningHost = window.location.hostname;
    const configuredIsLocal = configuredHost === "localhost" || configuredHost === "127.0.0.1";
    const runningIsLocal = runningHost === "localhost" || runningHost === "127.0.0.1";
    return configuredIsLocal && !runningIsLocal;
  } catch {
    return false;
  }
}

export function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = withLeadingSlash(path);
  if (apiBaseUrl && !shouldIgnoreConfiguredBaseUrl(apiBaseUrl)) {
    return `${apiBaseUrl}${normalizedPath}`;
  }

  return normalizedPath;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(url), {
    ...options,
    credentials: "include",
    cache: "no-store",
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
  role: "USER" | "AGENT" | "DELIVERY_BOY";
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

export async function addCustomerApi(name: string, area: string, assignedUserId?: string | null) {
  return requestJson<{ id: string }>("/api/customers", {
    method: "POST",
    body: JSON.stringify({ name, area, assignedUserId }),
  });
}

export async function updateCustomerStatusApi(customerId: string, status: "ACTIVE" | "STOPPED") {
  return requestJson<{ ok: boolean }>("/api/customers", {
    method: "PATCH",
    body: JSON.stringify({ customerId, status }),
  });
}

export async function updateCustomerAssignmentApi(
  customerId: string,
  assignedUserId: string | null,
) {
  return requestJson<{ ok: boolean }>("/api/customers", {
    method: "PATCH",
    body: JSON.stringify({ customerId, assignedUserId }),
  });
}

export async function listAssignableUsersApi() {
  return requestJson<{
    users: Array<{
      id: string;
      username: string;
      email: string | null;
      assignedCustomerCount: number;
    }>;
  }>("/api/users");
}

export async function listAdminUsersApi() {
  return requestJson<{
    users: Array<{
      id: string;
      username: string;
      email: string | null;
      role: "USER" | "AGENT" | "DELIVERY_BOY" | "ADMIN";
      approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
      createdAt: string;
      assignedCustomerCount: number;
      deliveryCount: number;
      salaryCount: number;
    }>;
  }>("/api/users?scope=all");
}

export async function deleteUserApi(userId: string) {
  return requestJson<{ ok: boolean }>("/api/users", {
    method: "DELETE",
    body: JSON.stringify({ userId }),
  });
}

export async function deleteCustomerApi(customerId: string) {
  return requestJson<{ ok: boolean }>("/api/customers", {
    method: "DELETE",
    body: JSON.stringify({ customerId }),
  });
}

export async function deleteCollectionApi(collectionId: string) {
  return requestJson<{ ok: boolean }>("/api/collections", {
    method: "DELETE",
    body: JSON.stringify({ collectionId }),
  });
}

export async function deleteDeliveryApi(deliveryId: string) {
  return requestJson<{ ok: boolean }>("/api/deliveries", {
    method: "DELETE",
    body: JSON.stringify({ deliveryId }),
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
