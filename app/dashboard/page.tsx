"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MonthlyMetrics } from "@/lib/calculations";
import {
  addCustomerApi,
  addDeliveryApi,
  addDueApi,
  buildApiUrl,
  confirmDeliveryApi,
  dashboardApi,
  generateInsightApi,
  getDeliveryBoyRegistrationsApi,
  getPendingCollections,
  listAssignableUsersApi,
  logoutApi,
  markCollectionPaidApi,
  recordCollectionApi,
  reviewDeliveryBoyApi,
  updateCustomerAssignmentApi,
  updateCustomerStatusApi,
} from "@/lib/client-api";
import { Collection, LedgerData, PaymentMode, User } from "@/lib/types";

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currency(value: number) {
  return `INR ${value.toFixed(2)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<LedgerData | null>(null);
  const [metrics, setMetrics] = useState<MonthlyMetrics | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [insight, setInsight] = useState("");
  const [insightSource, setInsightSource] = useState<"gemini" | "rule-based" | "">("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerArea, setCustomerArea] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [dueCustomerId, setDueCustomerId] = useState("");
  const [dueAmount, setDueAmount] = useState("");
  const [deliveryCustomerId, setDeliveryCustomerId] = useState("");
  const [deliveryOrdered, setDeliveryOrdered] = useState("");
  const [deliveryBoy, setDeliveryBoy] = useState("");
  const [deliveredQtyById, setDeliveredQtyById] = useState<Record<string, string>>({});
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "customer-management" | "collection-management" | "reports-insights" | "delivery-operations"
  >("collection-management");
  const [deliveryRegistrations, setDeliveryRegistrations] = useState<
    Array<{
      id: string;
      email: string | null;
      username: string;
      approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
      createdAt: string;
    }>
  >([]);
  const [assignableUsers, setAssignableUsers] = useState<
    Array<{
      id: string;
      username: string;
      email: string | null;
      assignedCustomerCount: number;
    }>
  >([]);
  const [allocationByCustomerId, setAllocationByCustomerId] = useState<Record<string, string>>({});
  const initialMonthRef = useRef(selectedMonth);
  const lastLoadedMonthRef = useRef<string | null>(null);

  const loadDashboard = useCallback(
    async (month: string) => {
      const payload = await dashboardApi(month);
      setData(payload.data);
      setMetrics(payload.metrics);
      lastLoadedMonthRef.current = month;
      return payload;
    },
    [],
  );

  const loadAssignableUsers = useCallback(async () => {
    const payload = await listAssignableUsersApi();
    setAssignableUsers(payload.users);
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const payload = await loadDashboard(initialMonthRef.current);
        if (!mounted) {
          return;
        }
        setCurrentUser(payload.viewer);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        const unauthorized = /401|unauth|forbidden/i.test(message);

        if (unauthorized) {
          router.replace("/login");
          return;
        }

        if (mounted) {
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [loadDashboard, router]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (lastLoadedMonthRef.current === selectedMonth) {
      return;
    }

    let mounted = true;
    setLoading(true);

    void loadDashboard(selectedMonth)
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to refresh dashboard";
        if (mounted) {
          setError(message);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [currentUser, loadDashboard, selectedMonth]);

  useEffect(() => {
    if (
      !currentUser ||
      !(currentUser.role === "AGENT" || currentUser.role === "ADMIN") ||
      activeSidebarTab !== "customer-management"
    ) {
      return;
    }

    void loadAssignableUsers().catch((err) => {
      const message = err instanceof Error ? err.message : "Failed to load users";
      setError(message);
    });
  }, [activeSidebarTab, currentUser, loadAssignableUsers]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "AGENT" || activeSidebarTab !== "delivery-operations") {
      return;
    }

    let mounted = true;
    void getDeliveryBoyRegistrationsApi()
      .then((registrations) => {
        if (!mounted) {
          return;
        }
        setDeliveryRegistrations(registrations.deliveryBoys);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load delivery registrations";
        if (mounted) {
          setError(message);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeSidebarTab, currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const source = new EventSource(buildApiUrl("/api/realtime/events"), {
      withCredentials: true,
    });
    const onLedger = () => {
      void loadDashboard(selectedMonth)
        .then(async () => {
          if (
            (currentUser.role === "AGENT" || currentUser.role === "ADMIN") &&
            activeSidebarTab === "customer-management"
          ) {
            await loadAssignableUsers();
          }
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to refresh dashboard";
          setError(message);
        });
    };

    source.addEventListener("ledger", onLedger);

    return () => {
      source.removeEventListener("ledger", onLedger);
      source.close();
    };
  }, [activeSidebarTab, currentUser, loadAssignableUsers, loadDashboard, selectedMonth]);

  const monthCollections = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.collections.filter((entry) => entry.monthYear === selectedMonth);
  }, [data, selectedMonth]);

  const deliveryView = useMemo(() => {
    if (!data || !currentUser) {
      return [];
    }

    if (currentUser.role === "DELIVERY_BOY") {
      return data.deliveries.filter((item) => item.deliveryBoy === currentUser.username);
    }

    return data.deliveries;
  }, [data, currentUser]);

  const pendingCollections = useMemo(() => {
    if (!data) {
      return [];
    }
    return getPendingCollections(data.collections, selectedMonth);
  }, [data, selectedMonth]);

  const deliveryBoys = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.users.filter(
      (user) => user.role === "DELIVERY_BOY" && user.approvalStatus === "APPROVED",
    );
  }, [data]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setAllocationByCustomerId((prev) => {
      const next: Record<string, string> = {};
      for (const customer of data.customers) {
        next[customer.id] = prev[customer.id] ?? customer.assignedUserId ?? "";
      }
      return next;
    });
  }, [data]);

  useEffect(() => {
    if (!deliveryBoy && deliveryBoys.length > 0) {
      setDeliveryBoy(deliveryBoys[0].username);
    }
  }, [deliveryBoy, deliveryBoys]);

  const runAction = async (action: () => Promise<void>) => {
    setError("");

    try {
      await action();
      await loadDashboard(selectedMonth);

      if (currentUser?.role === "AGENT" || currentUser?.role === "ADMIN") {
        await loadAssignableUsers();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
    }
  };

  const handleLogout = async () => {
    await logoutApi();
    router.replace("/login");
  };

  const addCustomer = (event: FormEvent) => {
    event.preventDefault();
    if (!customerName.trim() || !customerArea.trim()) {
      return;
    }

    void runAction(async () => {
      await addCustomerApi(
        customerName.trim(),
        customerArea.trim(),
        assignedUserId ? assignedUserId : undefined,
      );
      setCustomerName("");
      setCustomerArea("");
      setAssignedUserId("");
    });
  };

  const toggleCustomerStatus = (customerId: string, currentStatus: "ACTIVE" | "STOPPED") => {
    const nextStatus = currentStatus === "ACTIVE" ? "STOPPED" : "ACTIVE";
    void runAction(async () => {
      await updateCustomerStatusApi(customerId, nextStatus);
    });
  };

  const updateAllocationDraft = (customerId: string, userId: string) => {
    setAllocationByCustomerId((prev) => ({
      ...prev,
      [customerId]: userId,
    }));
  };

  const saveCustomerAllocation = (customerId: string) => {
    const nextUserId = allocationByCustomerId[customerId] ?? "";

    void runAction(async () => {
      await updateCustomerAssignmentApi(customerId, nextUserId ? nextUserId : null);
    });
  };

  const recordPayment = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer || !paymentAmount) {
      return;
    }

    const amount = Number(paymentAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      return;
    }

    void runAction(async () => {
      await recordCollectionApi({
        customerId: selectedCustomer,
        monthYear: selectedMonth,
        amount,
        mode: paymentMode,
      });
      setPaymentAmount("");
      setSelectedCustomer("");
    });
  };

  const addPendingDue = (event: FormEvent) => {
    event.preventDefault();
    if (!dueCustomerId || !dueAmount) {
      return;
    }

    const amount = Number(dueAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      return;
    }

    void runAction(async () => {
      await addDueApi({
        customerId: dueCustomerId,
        monthYear: selectedMonth,
        amount,
      });
      setDueAmount("");
      setDueCustomerId("");
    });
  };

  const markCollectionPaid = (collectionId: string) => {
    void runAction(async () => {
      await markCollectionPaidApi(collectionId);
    });
  };

  const addDelivery = (event: FormEvent) => {
    event.preventDefault();
    if (!deliveryCustomerId || !deliveryOrdered || !deliveryBoy) {
      return;
    }

    const ordered = Number(deliveryOrdered);
    if (Number.isNaN(ordered) || ordered <= 0) {
      return;
    }

    void runAction(async () => {
      await addDeliveryApi({
        customerId: deliveryCustomerId,
        ordered,
        deliveryBoyUsername: deliveryBoy,
      });
      setDeliveryCustomerId("");
      setDeliveryOrdered("");
    });
  };

  const reviewDeliveryRegistration = (userId: string, action: "APPROVE" | "REJECT") => {
    void runAction(async () => {
      await reviewDeliveryBoyApi(userId, action);
      const registrations = await getDeliveryBoyRegistrationsApi();
      setDeliveryRegistrations(registrations.deliveryBoys);
    });
  };

  const confirmDelivery = (deliveryId: string, ordered: number) => {
    const deliveredInput = Number(deliveredQtyById[deliveryId] ?? ordered);
    const safeDelivered = Number.isNaN(deliveredInput)
      ? ordered
      : Math.max(0, Math.min(ordered, deliveredInput));

    void runAction(async () => {
      await confirmDeliveryApi(deliveryId, safeDelivered);
      setDeliveredQtyById((prev) => {
        const next = { ...prev };
        delete next[deliveryId];
        return next;
      });
    });
  };

  const generateInsight = async () => {
    if (!metrics) {
      return;
    }

    setInsightLoading(true);
    setError("");

    try {
      const payload = await generateInsightApi({
        monthKey: selectedMonth,
        totalCollection: metrics.totalCollection,
        lossAmount: metrics.lossAmount,
        netProfit: metrics.netProfit,
        pendingCount: pendingCollections.length,
      });

      setInsight(payload.insight);
      setInsightSource(payload.source);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate insight";
      setInsight("Tip: increase early collections before the 10th to improve incentive.");
      setInsightSource("rule-based");
      setError(message);
    } finally {
      setInsightLoading(false);
    }
  };

  const isOverdue = (entry: Collection) => {
    if (entry.status !== "PENDING" || !entry.dueDate) {
      return false;
    }

    const due = new Date(entry.dueDate);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  const exportCollectionsCsv = () => {
    if (!data) {
      return;
    }

    const header = ["customer", "month", "amount", "status", "paymentDate", "dueDate", "mode"];
    const rows = monthCollections.map((entry) => {
      const customer = data.customers.find((item) => item.id === entry.customerId);
      return [
        customer?.name ?? "Unknown",
        entry.monthYear,
        entry.amount.toString(),
        entry.status,
        entry.paymentDate || "",
        entry.dueDate || "",
        entry.mode,
      ];
    });

    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `collections-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <main className="p-6">Loading...</main>;
  }

  if (!data || !currentUser) {
    return <main className="p-6">Session expired. Redirecting...</main>;
  }

  const canManage = currentUser.role === "AGENT" || currentUser.role === "ADMIN";

  const sidebarTabs = [
    ...(canManage
      ? ([
          { key: "customer-management", label: "Customer Management" },
          { key: "collection-management", label: "Collection Management" },
          { key: "reports-insights", label: "Reports and Insights" },
        ] as const)
      : []),
    { key: "delivery-operations", label: "Delivery Operations" } as const,
  ];

  return (
    <main className="min-h-screen bg-transparent p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900">SmartLedger Pro Dashboard</h1>
            <p className="text-sm text-slate-600">
              Logged in as <span className="font-semibold">{currentUser.username}</span> ({currentUser.role})
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Logout
          </button>
        </header>

        {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {metrics ? (
          <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard title="Collection" value={currency(metrics.totalCollection)} />
            <StatCard title="Agent Profit (20%)" value={currency(metrics.agentProfit)} />
            <StatCard title="Incentive (8%)" value={currency(metrics.incentive)} />
            <StatCard title="Salary" value={currency(metrics.salaryDeduction)} />
            <StatCard title="Loss" value={currency(metrics.lossAmount)} />
            <StatCard title="Net" value={currency(metrics.netProfit)} />
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Sidebar</h2>
            <p className="mt-1 text-xs text-slate-600">Toggle dashboard sections</p>
            <div className="mt-3 space-y-2">
              {sidebarTabs.map((tab) => {
                const active = activeSidebarTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSidebarTab(tab.key)}
                    className={`w-full rounded px-3 py-2 text-left text-sm font-medium transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-4">
            {canManage && activeSidebarTab === "customer-management" ? (
              <div className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Customer Management</h2>
              <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={addCustomer}>
                <input
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2"
                />
                <input
                  placeholder="Area"
                  value={customerArea}
                  onChange={(event) => setCustomerArea(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2"
                />
                <select
                  value={assignedUserId}
                  onChange={(event) => setAssignedUserId(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2"
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
                <button className="rounded bg-blue-600 px-3 py-2 text-white">Add Customer</button>
              </form>

              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700">
                  Database Users for Allocation ({assignableUsers.length})
                </p>
                {assignableUsers.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    No USER accounts found. Register USER accounts to allocate customers.
                  </p>
                ) : (
                  <ul className="mt-2 grid gap-1 text-xs text-slate-600 md:grid-cols-2">
                    {assignableUsers.map((user) => (
                      <li key={user.id} className="rounded border border-slate-200 bg-white px-2 py-1">
                        {user.username} (assigned {user.assignedCustomerCount})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <ul className="mt-3 space-y-2 text-sm">
                {data.customers.map((customer) => (
                  <li key={customer.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white p-2 text-slate-800">
                    <div className="flex-1">
                      <span>
                        {customer.name} - {customer.area} - {customer.status} - Assigned {customer.assignedUsername ?? "Unassigned"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={allocationByCustomerId[customer.id] ?? customer.assignedUserId ?? ""}
                        onChange={(event) => updateAllocationDraft(customer.id, event.target.value)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {assignableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.username}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => saveCustomerAllocation(customer.id)}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs text-white"
                      >
                        Save Allocation
                      </button>
                      <button
                        onClick={() => toggleCustomerStatus(customer.id, customer.status)}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-white"
                      >
                        {customer.status === "ACTIVE" ? "Stop" : "Resume"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={recordPayment}>
                <select
                  value={selectedCustomer}
                  onChange={(event) => setSelectedCustomer(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2"
                >
                  <option value="">Select customer</option>
                  {data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Amount"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2"
                />
                <select
                  value={paymentMode}
                  onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}
                  className="rounded border border-slate-300 px-3 py-2"
                >
                  <option value="CASH">Cash</option>
                  <option value="ONLINE">Online</option>
                </select>
                <button className="rounded bg-emerald-600 px-3 py-2 text-white">Record</button>
              </form>

              <p className="mt-4 text-xs text-slate-600">Create pending due</p>
              <form className="mt-2 grid gap-2 md:grid-cols-3" onSubmit={addPendingDue}>
                <select
                  value={dueCustomerId}
                  onChange={(event) => setDueCustomerId(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2"
                >
                  <option value="">Select customer</option>
                  {data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Due amount"
                  value={dueAmount}
                  onChange={(event) => setDueAmount(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2"
                />
                <button className="rounded bg-amber-600 px-3 py-2 text-white">Add Due</button>
              </form>

              {pendingCollections.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {pendingCollections.map((entry) => {
                    const customer = data.customers.find((item) => item.id === entry.customerId);
                    const overdue = isOverdue(entry);
                    return (
                      <li
                        key={entry.id}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded p-2 text-slate-800 ${
                          overdue
                            ? "border border-red-200 bg-red-50"
                            : "border border-amber-200 bg-amber-50"
                        }`}
                      >
                        <span>
                          Pending: {customer?.name ?? "Unknown"} - {currency(entry.amount)} - {entry.monthYear} - Due {entry.dueDate || "-"}
                          {overdue ? " - OVERDUE" : ""}
                        </span>
                        <button
                          onClick={() => markCollectionPaid(entry.id)}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                        >
                          Mark Paid
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <ul className="mt-3 space-y-2 text-sm">
                {monthCollections.map((entry) => {
                  const customer = data.customers.find((item) => item.id === entry.customerId);
                  return (
                    <li key={entry.id} className="rounded border border-slate-200 bg-white p-2 text-slate-800">
                      {customer?.name ?? "Unknown"} - {currency(entry.amount)} - {entry.status} - {entry.paymentDate || "-"}
                    </li>
                  );
                })}
              </ul>
              </div>
            ) : null}

            {canManage && activeSidebarTab === "reports-insights" ? (
              <div className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Reports and Insights</h2>
              <p className="mt-2 text-sm text-slate-600">
                Month: {selectedMonth} | Customers: {data.customers.length} | Deliveries: {data.deliveries.length} | Pending Dues: {pendingCollections.length}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2"
                />
                <button
                  onClick={exportCollectionsCsv}
                  className="rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800"
                >
                  Export CSV
                </button>
              </div>
              <button
                onClick={generateInsight}
                className="mt-3 rounded bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-700"
              >
                {insightLoading ? "Generating..." : "Generate AI Insight"}
              </button>
              <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-700">
                {insight || "No insight yet. Click the button to generate."}
              </p>
              {insight ? (
                <p className="mt-1 text-xs text-slate-500">Insight source: {insightSource || "rule-based"}</p>
              ) : null}
              </div>
            ) : null}

            {activeSidebarTab === "delivery-operations" ? (
              <>
                {canManage ? (
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Add Delivery</h2>
                    <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={addDelivery}>
                      <select
                        value={deliveryCustomerId}
                        onChange={(event) => setDeliveryCustomerId(event.target.value)}
                        className="rounded border border-slate-300 px-3 py-2"
                      >
                        <option value="">Select customer</option>
                        {data.customers
                          .filter((customer) => customer.status === "ACTIVE")
                          .map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Ordered copies"
                        value={deliveryOrdered}
                        onChange={(event) => setDeliveryOrdered(event.target.value)}
                        className="rounded border border-slate-300 px-3 py-2"
                      />
                      <select
                        value={deliveryBoy}
                        onChange={(event) => setDeliveryBoy(event.target.value)}
                        className="rounded border border-slate-300 px-3 py-2"
                      >
                        {deliveryBoys.map((boy) => (
                          <option key={boy.id} value={boy.username}>
                            {boy.username}
                          </option>
                        ))}
                      </select>
                      <button className="rounded bg-blue-600 px-3 py-2 text-white">Create Delivery</button>
                    </form>
                  </div>
                ) : null}

                {currentUser.role === "AGENT" ? (
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Delivery Boy Registrations</h2>
                    <p className="mt-1 text-xs text-slate-600">Approve or reject new delivery boy accounts.</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {deliveryRegistrations.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white p-2 text-slate-800"
                        >
                          <span>
                            {entry.email ?? entry.username} - {entry.approvalStatus}
                          </span>
                          {entry.approvalStatus === "PENDING" ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => reviewDeliveryRegistration(entry.id, "APPROVE")}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => reviewDeliveryRegistration(entry.id, "REJECT")}
                                className="rounded bg-red-600 px-2 py-1 text-xs text-white"
                              >
                                Reject
                              </button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <section className="rounded-lg bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Delivery Confirmation</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {deliveryView.map((entry) => {
                      const customer = data.customers.find((item) => item.id === entry.customerId);
                      return (
                        <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white p-2 text-slate-800">
                          <span>
                            {customer?.name ?? "Unknown"} - Ordered {entry.ordered} - Delivered {entry.delivered} - Returned {entry.ordered - entry.delivered} - {entry.status}
                          </span>
                          {entry.status === "PENDING" && currentUser.role !== "USER" ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={entry.ordered}
                                value={deliveredQtyById[entry.id] ?? ""}
                                onChange={(event) =>
                                  setDeliveredQtyById((prev) => ({
                                    ...prev,
                                    [entry.id]: event.target.value,
                                  }))
                                }
                                placeholder={`0-${entry.ordered}`}
                                className="w-24 rounded border border-slate-300 px-2 py-1"
                              />
                              <button
                                onClick={() => confirmDelivery(entry.id, entry.ordered)}
                                className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white"
                              >
                                Confirm
                              </button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
