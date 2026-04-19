import { CustomerStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishEvent } from "@/lib/realtime";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/validators";

async function resolveAssignedUserId(assignedUserId: string | null | undefined) {
  if (assignedUserId === undefined) {
    return undefined;
  }

  if (assignedUserId === null) {
    return null;
  }

  const assignedUser = await db.user.findUnique({
    where: { id: assignedUserId },
    select: { id: true, role: true },
  });

  if (!assignedUser || assignedUser.role !== "USER") {
    return "invalid" as const;
  }

  return assignedUser.id;
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT", "ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const parsed = createCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid customer data" }, { status: 400 });
  }

  const assignedUserId = await resolveAssignedUserId(parsed.data.assignedUserId);
  if (assignedUserId === "invalid") {
    return NextResponse.json({ message: "Assigned user not found" }, { status: 400 });
  }

  const customer = await db.customer.create({
    data: {
      name: parsed.data.name,
      area: parsed.data.area,
      status: CustomerStatus.ACTIVE,
      assignedUserId: assignedUserId ?? null,
    },
  });

  publishEvent({ type: "customer.created", entityId: customer.id });
  return NextResponse.json({ id: customer.id });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT", "ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const parsed = updateCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid update payload" }, { status: 400 });
  }

  const nextAssignedUserId = await resolveAssignedUserId(parsed.data.assignedUserId);
  if (nextAssignedUserId === "invalid") {
    return NextResponse.json({ message: "Assigned user not found" }, { status: 400 });
  }

  const updateData: {
    status?: CustomerStatus;
    assignedUserId?: string | null;
  } = {};

  if (parsed.data.status) {
    updateData.status =
      parsed.data.status === "ACTIVE" ? CustomerStatus.ACTIVE : CustomerStatus.STOPPED;
  }

  if (parsed.data.assignedUserId !== undefined) {
    updateData.assignedUserId = nextAssignedUserId;
  }

  const customer = await db.customer.update({
    where: { id: parsed.data.customerId },
    data: updateData,
  });

  publishEvent({ type: "customer.updated", entityId: customer.id });
  return NextResponse.json({ ok: true });
}
