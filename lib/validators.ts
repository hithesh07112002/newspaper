import { z } from "zod";

const registerPasswordPolicyMessage =
  "Password must be at least 10 characters and include at least one letter and one number.";

const registerPasswordSchema = z
  .string()
  .min(10, registerPasswordPolicyMessage)
  .max(120)
  .regex(/[A-Za-z]/, registerPasswordPolicyMessage)
  .regex(/[0-9]/, registerPasswordPolicyMessage);

export const loginSchema = z.object({
  identifier: z.string().min(3).max(120),
  password: z.string().min(6).max(120),
});

export const registerSchema = z.object({
  email: z.string().email().max(120),
  password: registerPasswordSchema,
  role: z.enum(["USER", "AGENT", "DELIVERY_BOY"]),
});

export const reviewDeliveryBoySchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
});

const assignedUserIdSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().min(1).nullable().optional(),
);

export const createCustomerSchema = z.object({
  name: z.string().min(2).max(120),
  area: z.string().min(2).max(120),
  assignedUserId: assignedUserIdSchema,
});

export const updateCustomerSchema = z
  .object({
    customerId: z.string().min(1),
    status: z.enum(["ACTIVE", "STOPPED"]).optional(),
    assignedUserId: assignedUserIdSchema,
  })
  .refine((value) => value.status !== undefined || value.assignedUserId !== undefined, {
    message: "At least one field to update is required",
  });

export const createCollectionSchema = z.object({
  customerId: z.string().min(1),
  monthYear: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().positive(),
  mode: z.enum(["CASH", "ONLINE"]),
  status: z.enum(["PAID", "PENDING"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

export const deleteUserSchema = z.object({
  userId: z.string().min(1),
});

export const deleteCustomerSchema = z.object({
  customerId: z.string().min(1),
});

export const deleteCollectionSchema = z.object({
  collectionId: z.string().min(1),
});

export const deleteDeliverySchema = z.object({
  deliveryId: z.string().min(1),
});

export const insightInputSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  totalCollection: z.number().finite().nonnegative(),
  lossAmount: z.number().finite().nonnegative(),
  netProfit: z.number().finite(),
  pendingCount: z.number().int().nonnegative(),
});
