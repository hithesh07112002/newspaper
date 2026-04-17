import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import type { UserRole } from "@/lib/types";

const TOKEN_COOKIE = "smartledger_session";

type AuthTokenPayload = {
  userId: string;
  username: string;
  role: UserRole;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required");
  }

  const effectiveSecret = secret || "smartledger-dev-only-secret";
  return new TextEncoder().encode(effectiveSecret);
}

export async function createAuthToken(payload: AuthTokenPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as unknown as AuthTokenPayload;
}

export function getSessionCookieName() {
  return TOKEN_COOKIE;
}

export async function getAuthUserFromRequest(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    return await verifyAuthToken(token);
  } catch {
    return null;
  }
}

export async function requireRole(
  request: NextRequest,
  allowedRoles?: UserRole[],
) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }

  return { ok: true as const, user };
}
