import { CollectionStatus, PaymentMode } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMonthDate } from "@/lib/date";
import { publishEvent } from "@/lib/realtime";
import { createCollectionSchema, markCollectionPaidSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT", "ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const parsed = createCollectionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid collection data" }, { status: 400 });
  }

  const created = await db.collection.create({
    data: {
      customerId: parsed.data.customerId,
      monthYear: parsed.data.monthYear,
      amount: parsed.data.amount,
      mode: parsed.data.mode === "ONLINE" ? PaymentMode.ONLINE : PaymentMode.CASH,
      status: parsed.data.status === "PAID" ? CollectionStatus.PAID : CollectionStatus.PENDING,
      paymentDate: parsed.data.status === "PAID" ? new Date() : null,
      dueDate: parsed.data.status === "PENDING"
        ? parsed.data.dueDate
          ? new Date(`${parsed.data.dueDate}T00:00:00.000Z`)
          : parseMonthDate(parsed.data.monthYear, 10)
        : null,
    },
  });

  publishEvent({ type: "collection.created", entityId: created.id, monthYear: parsed.data.monthYear });
  return NextResponse.json({ id: created.id });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT", "ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const parsed = markCollectionPaidSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid update payload" }, { status: 400 });
  }

  const updated = await db.collection.update({
    where: { id: parsed.data.collectionId },
    data: {
      status: CollectionStatus.PAID,
      paymentDate: new Date(),
    },
  });

  publishEvent({ type: "collection.updated", entityId: updated.id, monthYear: updated.monthYear });
  return NextResponse.json({ ok: true });
}
