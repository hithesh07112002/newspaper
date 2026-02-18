export type UserRole = "AGENT" | "DELIVERY_BOY";

export type PaymentMode = "CASH" | "ONLINE";

export type DeliveryStatus = "PENDING" | "DELIVERED";

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
}

export interface Customer {
  id: string;
  name: string;
  area: string;
  status: "ACTIVE" | "STOPPED";
}

export interface Delivery {
  id: string;
  customerId: string;
  date: string;
  ordered: number;
  delivered: number;
  deliveryBoy: string;
  status: DeliveryStatus;
}

export interface Collection {
  id: string;
  customerId: string;
  monthYear: string;
  amount: number;
  paymentDate: string;
  dueDate?: string;
  mode: PaymentMode;
  status: "PAID" | "PENDING";
}

export interface Salary {
  id: string;
  deliveryBoy: string;
  monthYear: string;
  amount: number;
}

export interface LedgerData {
  users: User[];
  customers: Customer[];
  deliveries: Delivery[];
  collections: Collection[];
  salaries: Salary[];
  unitCost: number;
}
