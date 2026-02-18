"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateMetrics } from "@/lib/calculations";
import { getLedgerData, getSessionUser, logout, setLedgerData } from "@/lib/storage";
import { Collection, Customer, Delivery, LedgerData, PaymentMode } from "@/lib/types";

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currency(value: number) {
  return `₹${value.toFixed(2)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<LedgerData | null>(null);
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [insight, setInsight] = useState("");
  const [insightSource, setInsightSource] = useState<"gemini" | "rule-based" | "">("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerArea, setCustomerArea] = useState("");
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

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    setCurrentUser(user);
    setData(getLedgerData());
  }, [router]);

  const metrics = useMemo(() => {
    if (!data) {
      return null;
    }
    return calculateMetrics(data, selectedMonth);
  }, [data, selectedMonth]);

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
    if (currentUser.role === "AGENT") {
      return data.deliveries;
    }
    return data.deliveries.filter((item) => item.deliveryBoy === currentUser.username);
  }, [data, currentUser]);

  const pendingCollections = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.collections.filter(
      (entry) => entry.status === "PENDING" && entry.monthYear === selectedMonth,
    );
  }, [data, selectedMonth]);

  const deliveryBoys = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.users.filter((user) => user.role === "DELIVERY_BOY");
  }, [data]);

  useEffect(() => {
    if (!deliveryBoy && deliveryBoys.length > 0) {
      setDeliveryBoy(deliveryBoys[0].username);
    }
  }, [deliveryBoys, deliveryBoy]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const syncData = (nextData: LedgerData) => {
    setData(nextData);
    setLedgerData(nextData);
  };

  const addCustomer = (event: FormEvent) => {
    event.preventDefault();
    if (!data || !customerName.trim() || !customerArea.trim()) {
      return;
    }

    const nextCustomer: Customer = {
      id: `c-${Date.now()}`,
      name: customerName.trim(),
      area: customerArea.trim(),
      status: "ACTIVE",
    };

    syncData({ ...data, customers: [...data.customers, nextCustomer] });
    setCustomerName("");
    setCustomerArea("");
  };

  const toggleCustomerStatus = (customerId: string) => {
    if (!data) {
      return;
    }

    const customers = data.customers.map((customer) => {
      if (customer.id !== customerId) {
        return customer;
      }
      return {
        ...customer,
        status: customer.status === "ACTIVE" ? ("STOPPED" as const) : ("ACTIVE" as const),
      };
    });

    syncData({ ...data, customers });
  };

  const recordPayment = (event: FormEvent) => {
    event.preventDefault();
    if (!data || !selectedCustomer || !paymentAmount) {
      return;
    }

    const amount = Number(paymentAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      return;
    }

    const nextCollection: Collection = {
      id: `p-${Date.now()}`,
      customerId: selectedCustomer,
      monthYear: selectedMonth,
      amount,
      paymentDate: new Date().toISOString().slice(0, 10),
      mode: paymentMode,
      status: "PAID",
    };

    syncData({ ...data, collections: [...data.collections, nextCollection] });
    setPaymentAmount("");
    setSelectedCustomer("");
  };

  const addPendingDue = (event: FormEvent) => {
    event.preventDefault();
    if (!data || !dueCustomerId || !dueAmount) {
      return;
    }

    const amount = Number(dueAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      return;
    }

    const nextDue: Collection = {
      id: `pd-${Date.now()}`,
      customerId: dueCustomerId,
      monthYear: selectedMonth,
      amount,
      paymentDate: "",
      dueDate: `${selectedMonth}-10`,
      mode: "CASH",
      status: "PENDING",
    };

    syncData({ ...data, collections: [...data.collections, nextDue] });
    setDueAmount("");
    setDueCustomerId("");
  };

  const markCollectionPaid = (collectionId: string) => {
    if (!data) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const collections = data.collections.map((entry) => {
      if (entry.id !== collectionId) {
        return entry;
      }

      return {
        ...entry,
        status: "PAID" as const,
        paymentDate: today,
      };
    });

    syncData({ ...data, collections });
  };

  const addDelivery = (event: FormEvent) => {
    event.preventDefault();
    if (!data || !deliveryCustomerId || !deliveryOrdered || !deliveryBoy) {
      return;
    }

    const ordered = Number(deliveryOrdered);
    if (Number.isNaN(ordered) || ordered <= 0) {
      return;
    }

    const nextDelivery: Delivery = {
      id: `d-${Date.now()}`,
      customerId: deliveryCustomerId,
      date: new Date().toISOString(),
      ordered,
      delivered: 0,
      deliveryBoy,
      status: "PENDING",
    };

    syncData({ ...data, deliveries: [...data.deliveries, nextDelivery] });
    setDeliveryCustomerId("");
    setDeliveryOrdered("");
  };

  const confirmDelivery = (deliveryId: string) => {
    if (!data) {
      return;
    }

    const nextDeliveries: Delivery[] = data.deliveries.map((entry) => {
      if (entry.id !== deliveryId) {
        return entry;
      }

      const deliveredInput = Number(deliveredQtyById[deliveryId] ?? entry.ordered);
      const safeDelivered = Number.isNaN(deliveredInput)
        ? entry.ordered
        : Math.max(0, Math.min(entry.ordered, deliveredInput));

      return {
        ...entry,
        status: "DELIVERED",
        delivered: safeDelivered,
        date: new Date().toISOString(),
      };
    });

    syncData({ ...data, deliveries: nextDeliveries });
    setDeliveredQtyById((prev) => {
      const next = { ...prev };
      delete next[deliveryId];
      return next;
    });
  };

  const generateInsight = async () => {
    if (!metrics) {
      return;
    }

    setInsightLoading(true);
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: selectedMonth,
          totalCollection: metrics.totalCollection,
          lossAmount: metrics.lossAmount,
          netProfit: metrics.netProfit,
          pendingCount: pendingCollections.length,
        }),
      });

      const payload = (await response.json()) as {
        insight?: string;
        source?: "gemini" | "rule-based";
      };
      setInsight(payload.insight ?? "No insight available.");
      setInsightSource(payload.source ?? "rule-based");
    } catch {
      setInsight("Tip: Increase early collections before the 10th to boost your 8% incentive.");
      setInsightSource("rule-based");
    } finally {
      setInsightLoading(false);
    }
  };

  if (!data || !currentUser) {
    return <main className="p-6">Loading...</main>;
  }

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

  return (
    <main className="min-h-screen bg-transparent p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900">SmartLedger Lite Dashboard</h1>
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

        {currentUser.role === "AGENT" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Customer Management</h2>
              <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={addCustomer}>
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
                <button className="rounded bg-blue-600 px-3 py-2 text-white">Add Customer</button>
              </form>
              <ul className="mt-3 space-y-2 text-sm">
                {data.customers.map((customer) => (
                  <li key={customer.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white p-2 text-slate-800">
                    <span>
                      {customer.name} • {customer.area} • {customer.status}
                    </span>
                    <button
                      onClick={() => toggleCustomerStatus(customer.id)}
                      className="rounded bg-slate-700 px-2 py-1 text-xs text-white"
                    >
                      {customer.status === "ACTIVE" ? "Stop" : "Resume"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Collection Tracking</h2>
              <p className="mt-1 text-xs text-slate-600">Record direct payment</p>
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
                          Pending: {customer?.name ?? "Unknown"} • {currency(entry.amount)} • {entry.monthYear} • Due {entry.dueDate || "-"}
                          {overdue ? " • OVERDUE" : ""}
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
                      {customer?.name ?? "Unknown"} • {currency(entry.amount)} • {entry.status} • {entry.paymentDate || "-"}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-sm lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Reports & Insights</h2>
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

            <div className="rounded-lg bg-white p-4 shadow-sm lg:col-span-2">
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
          </section>
        ) : null}

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Confirmation</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {deliveryView.map((entry) => {
              const customer = data.customers.find((item) => item.id === entry.customerId);
              return (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white p-2 text-slate-800">
                  <span>
                    {customer?.name ?? "Unknown"} • Ordered {entry.ordered} • Delivered {entry.delivered} • Returned {entry.ordered - entry.delivered} • {entry.status}
                  </span>
                  {entry.status === "PENDING" ? (
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
                        onClick={() => confirmDelivery(entry.id)}
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
