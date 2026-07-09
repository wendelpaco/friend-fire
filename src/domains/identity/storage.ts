/**
 * Client identity persistence (localStorage).
 * Keys: ff_session_id, ff_xp, ff_nickname, ff_region
 */

import type { RegionCode } from "./types";

const SESSION_KEY = "ff_session_id";
const XP_KEY = "ff_xp";
const NICK_KEY = "ff_nickname";
const REGION_KEY = "ff_region";

/** In-process fallback when localStorage is unavailable / throws. */
let memorySessionId: string | null = null;

function newSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = memorySessionId ?? newSessionId();
      localStorage.setItem(SESSION_KEY, id);
    }
    memorySessionId = id;
    return id;
  } catch {
    if (!memorySessionId) memorySessionId = newSessionId();
    return memorySessionId;
  }
}

export function getXp(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(XP_KEY) || "0") || 0;
  } catch {
    return 0;
  }
}

export function setXp(xp: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(XP_KEY, String(Math.max(0, Math.floor(xp))));
  } catch {
    /* ignore */
  }
}

/** Add XP and persist; returns new total. */
export function grantXp(amount: number): number {
  const next = Math.max(0, getXp()) + Math.max(0, Math.floor(amount));
  setXp(next);
  return next;
}

export function getNickname(): string {
  if (typeof window === "undefined") return "Operador";
  try {
    return localStorage.getItem(NICK_KEY) || "Operador";
  } catch {
    return "Operador";
  }
}

export function setNickname(name: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NICK_KEY, name.trim().slice(0, 16) || "Operador");
  } catch {
    /* ignore */
  }
}

export function getRegion(): RegionCode {
  if (typeof window === "undefined") return "BR";
  try {
    const v = localStorage.getItem(REGION_KEY);
    return v === "US" ? "US" : "BR";
  } catch {
    return "BR";
  }
}

export function setRegion(region: RegionCode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REGION_KEY, region);
  } catch {
    /* ignore */
  }
}
