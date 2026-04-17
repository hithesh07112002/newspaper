import { CustomerStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishEvent } from "@/lib/realtime";
import { createCustomerSchema, updateCustomerStatusSchema } from "@/lib/validators";

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

  const customer = await db.customer.create({
    data: {
      name: parsed.data.name,
      area: parsed.data.area,
      status: CustomerStatus.ACTIVE,
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
  const parsed = updateCustomerStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid update payload" }, { status: 400 });
  }

  const customer = await db.customer.update({
    where: { id: parsed.data.customerId },
    data: { status: parsed.data.status === "ACTIVE" ? CustomerStatus.ACTIVE : CustomerStatus.STOPPED },
  });

  publishEvent({ type: "customer.updated", entityId: customer.id });
  return NextResponse.json({ ok: true });
}
