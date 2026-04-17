export type UserRole = "USER" | "AGENT" | "DELIVERY_BOY" | "ADMIN";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type PaymentMode = "CASH" | "ONLINE";

export type DeliveryStatus = "PENDING" | "DELIVERED";

export type CustomerStatus = "ACTIVE" | "STOPPED";

export type CollectionStatus = "PAID" | "PENDING";

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  approvalStatus?: ApprovalStatus;
}

export interface Customer {
  id: string;
  name: string;
  area: string;
  status: CustomerStatus;
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
  status: CollectionStatus;
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
