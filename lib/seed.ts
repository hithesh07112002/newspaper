import { LedgerData } from "./types";

const today = new Date();
const monthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

export const seededData: LedgerData = {
  unitCost: 5,
  users: [
    { id: "u1", username: "agent1", role: "AGENT" },
    { id: "u2", username: "boy1", role: "DELIVERY_BOY" },
    { id: "u3", username: "admin", role: "ADMIN" },
  ],
  customers: [
    { id: "c1", name: "Ravi Kumar", area: "North Street", status: "ACTIVE" },
    { id: "c2", name: "Anita Devi", area: "Market Road", status: "ACTIVE" },
  ],
  deliveries: [
    {
      id: "d1",
      customerId: "c1",
      date: today.toISOString(),
      ordered: 30,
      delivered: 30,
      deliveryBoy: "boy1",
      status: "DELIVERED",
    },
    {
      id: "d2",
      customerId: "c2",
      date: today.toISOString(),
      ordered: 30,
      delivered: 27,
      deliveryBoy: "boy1",
      status: "DELIVERED",
    },
  ],
  collections: [
    {
      id: "p1",
      customerId: "c1",
      monthYear,
      amount: 450,
      paymentDate: `${monthYear}-07`,
      mode: "ONLINE",
      status: "PAID",
    },
    {
      id: "p2",
      customerId: "c2",
      monthYear,
      amount: 420,
      paymentDate: "",
      dueDate: `${monthYear}-10`,
      mode: "CASH",
      status: "PENDING",
    },
  ],
  salaries: [
    {
      id: "s1",
      deliveryBoy: "boy1",
      monthYear,
      amount: 300,
    },
  ],
};
