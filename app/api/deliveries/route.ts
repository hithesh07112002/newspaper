import { DeliveryStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishEvent } from "@/lib/realtime";
import { confirmDeliverySchema, createDeliverySchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT", "ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const parsed = createDeliverySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid delivery data" }, { status: 400 });
  }

  const deliveryBoy = await (db.user as any).findUnique({ where: { username: parsed.data.deliveryBoyUsername } });
  if (!deliveryBoy || deliveryBoy.role !== "DELIVERY_BOY") {
    return NextResponse.json({ message: "Delivery boy not found" }, { status: 404 });
  }

  if (deliveryBoy.approvalStatus !== "APPROVED") {
    return NextResponse.json({ message: "Delivery boy is not approved" }, { status: 400 });
  }

  const created = await db.delivery.create({
    data: {
      customerId: parsed.data.customerId,
      ordered: parsed.data.ordered,
      delivered: 0,
      deliveryBoyId: deliveryBoy.id,
      status: DeliveryStatus.PENDING,
      date: new Date(),
    },
  });

  publishEvent({ type: "delivery.created", entityId: created.id });
  return NextResponse.json({ id: created.id });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT", "DELIVERY_BOY", "ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const parsed = confirmDeliverySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid delivery confirmation" }, { status: 400 });
  }

  const delivery = await db.delivery.findUnique({
    where: { id: parsed.data.deliveryId },
    include: { deliveryBoy: true },
  });

  if (!delivery) {
    return NextResponse.json({ message: "Delivery not found" }, { status: 404 });
  }

  if (auth.user.role === "DELIVERY_BOY" && delivery.deliveryBoy.username !== auth.user.username) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const safeDelivered = Math.max(0, Math.min(delivery.ordered, parsed.data.delivered));

  const updated = await db.delivery.update({
    where: { id: delivery.id },
    data: {
      delivered: safeDelivered,
      status: DeliveryStatus.DELIVERED,
      date: new Date(),
    },
  });

  publishEvent({ type: "delivery.updated", entityId: updated.id });
  return NextResponse.json({ ok: true });
}
