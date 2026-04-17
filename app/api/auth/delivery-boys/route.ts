import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { reviewDeliveryBoySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const deliveryBoys = await db.user.findMany({
    where: {
      role: "DELIVERY_BOY",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      username: true,
      approvalStatus: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ deliveryBoys });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const parsed = reviewDeliveryBoySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid review request" }, { status: 400 });
  }

  const found = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!found || found.role !== "DELIVERY_BOY") {
    return NextResponse.json({ message: "Delivery boy not found" }, { status: 404 });
  }

  const nextStatus =
    parsed.data.action === "APPROVE"
      ? "APPROVED"
      : "REJECTED";

  await db.user.update({
    where: { id: parsed.data.userId },
    data: { approvalStatus: nextStatus },
  });

  return NextResponse.json({ ok: true });
}
