import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishEvent } from "@/lib/realtime";
import { deleteUserSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT", "ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const scope = request.nextUrl.searchParams.get("scope");
  if (scope === "all") {
    if (auth.user.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        approvalStatus: true,
        createdAt: true,
        _count: {
          select: {
            assignedCustomers: true,
            deliveries: true,
            salaries: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        users: users.map((user) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          approvalStatus: user.approvalStatus,
          createdAt: user.createdAt.toISOString(),
          assignedCustomerCount: user._count.assignedCustomers,
          deliveryCount: user._count.deliveries,
          salaryCount: user._count.salaries,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const users = await db.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      email: true,
      _count: {
        select: {
          assignedCustomers: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        assignedCustomerCount: user._count.assignedCustomers,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid delete payload" }, { status: 400 });
  }

  if (parsed.data.userId === auth.user.userId) {
    return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  if (targetUser.role === "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { message: "Cannot delete the last admin account." },
        { status: 400 },
      );
    }
  }

  try {
    await db.user.delete({ where: { id: parsed.data.userId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return NextResponse.json(
          { message: "Delete related deliveries and salary entries before deleting this user." },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
      }
    }
    return NextResponse.json(
      { message: "Unable to delete user right now. Please try again." },
      { status: 500 },
    );
  }

  publishEvent({ type: "user.deleted", entityId: parsed.data.userId });
  return NextResponse.json({ ok: true });
}