"use client";

import { seededData } from "./seed";
import { LedgerData, User } from "./types";

const LEDGER_KEY = "smartledger-lite-data";
const SESSION_KEY = "smartledger-lite-session";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function ensureSeedData(): LedgerData {
  if (!canUseStorage()) {
    return seededData;
  }

  const existing = window.localStorage.getItem(LEDGER_KEY);
  if (!existing) {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(seededData));
    return seededData;
  }

  try {
    return JSON.parse(existing) as LedgerData;
  } catch {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(seededData));
    return seededData;
  }
}

export function getLedgerData(): LedgerData {
  return ensureSeedData();
}

export function setLedgerData(data: LedgerData) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(LEDGER_KEY, JSON.stringify(data));
}

export function login(username: string, password: string): User | null {
  const data = getLedgerData();
  const user = data.users.find(
    (item) => item.username === username.trim() && item.password === password.trim(),
  );

  if (!user || !canUseStorage()) {
    return user ?? null;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function getSessionUser(): User | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function logout() {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
}
