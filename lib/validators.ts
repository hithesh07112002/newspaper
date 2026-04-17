import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(3).max(120),
  password: z.string().min(6).max(120),
});

export const registerSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(6).max(120),
  role: z.enum(["USER", "DELIVERY_BOY"]),
});

export const reviewDeliveryBoySchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
});

export const createCustomerSchema = z.object({
  name: z.string().min(2).max(120),
  area: z.string().min(2).max(120),
});

export const updateCustomerStatusSchema = z.object({
  customerId: z.string().min(1),
  status: z.enum(["ACTIVE", "STOPPED"]),
});

export const createCollectionSchema = z.object({
  customerId: z.string().min(1),
  monthYear: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().positive(),
  mode: z.enum(["CASH", "ONLINE"]),
  status: z.enum(["PAID", "PENDING"]),
  dueDate: z.string().optional(),
});

export const markCollectionPaidSchema = z.object({
  collectionId: z.string().min(1),
});

export const createDeliverySchema = z.object({
  customerId: z.string().min(1),
  ordered: z.number().int().positive(),
  deliveryBoyUsername: z.string().min(2).max(40),
});

export const confirmDeliverySchema = z.object({
  deliveryId: z.string().min(1),
  delivered: z.number().int().min(0),
});

export const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});
