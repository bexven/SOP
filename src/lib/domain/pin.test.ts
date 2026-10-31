import { describe, expect, it } from "vitest";
import {
  afterFailedAttempt,
  afterSuccessfulAttempt,
  isIpThrottled,
  isLocked,
  isValidPinFormat,
  isWeakPin,
  LOCKOUT_MINUTES,
  MAX_FAILED_ATTEMPTS,
  minutesUntilUnlock,
  type LockState,
} from "./pin";

const now = new Date("2026-11-01T06:00:00Z");
const fresh: LockState = { failedPinAttempts: 0, lockedUntil: null };

describe("PIN format", () => {
  it("accepts 4–6 digits only", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("123456")).toBe(true);
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("1234567")).toBe(false);
    expect(isValidPinFormat("12a4")).toBe(false);
    expect(isValidPinFormat(" 1234")).toBe(false);
  });

  it("flags trivially weak PINs", () => {
    expect(isWeakPin("1111")).toBe(true);
    expect(isWeakPin("1234")).toBe(true);
    expect(isWeakPin("654321")).toBe(true);
    expect(isWeakPin("2580")).toBe(false);
    expect(isWeakPin("1357")).toBe(false);
  });
});

describe("lockout", () => {
  it("counts failures and locks on the 5th", () => {
    let state = fresh;
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      state = afterFailedAttempt(state, now);
      expect(state.failedPinAttempts).toBe(i);
      expect(isLocked(state, now)).toBe(false);
    }
    state = afterFailedAttempt(state, now);
    expect(isLocked(state, now)).toBe(true);
    expect(state.lockedUntil!.getTime() - now.getTime()).toBe(LOCKOUT_MINUTES * 60_000);
    expect(minutesUntilUnlock(state, now)).toBe(15);
  });

  it("unlocks after 15 minutes and starts a fresh count", () => {
    const locked: LockState = { failedPinAttempts: 0, lockedUntil: new Date(now.getTime() + 60_000) };
    const later = new Date(now.getTime() + 2 * 60_000);
    expect(isLocked(locked, later)).toBe(false);
    expect(minutesUntilUnlock(locked, later)).toBe(0);
    expect(afterFailedAttempt(locked, later)).toEqual({ failedPinAttempts: 1, lockedUntil: null });
  });

  it("resets on success", () => {
    expect(afterSuccessfulAttempt()).toEqual(fresh);
  });

  it("throttles an IP after 20 failures in the window", () => {
    expect(isIpThrottled(19)).toBe(false);
    expect(isIpThrottled(20)).toBe(true);
  });
});
