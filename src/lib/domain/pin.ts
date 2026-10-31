/**
 * PIN policy and lockout rules (pure).
 *
 * - A PIN is 4–6 digits.
 * - 5 consecutive failed attempts lock the account for 15 minutes.
 * - A per-IP throttle blocks an address after too many failures in a window,
 *   so someone can't cycle through accounts on the login screen.
 */

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const IP_WINDOW_MINUTES = 15;
export const IP_MAX_FAILURES = 20;

export const PIN_REGEX = /^\d{4,6}$/;

export function isValidPinFormat(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

/** Rejects trivially guessable PINs (all same digit, simple runs). */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const digits = pin.split("").map(Number);
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1]! + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1]! - 1);
  return ascending || descending;
}

export type LockState = {
  failedPinAttempts: number;
  lockedUntil: Date | null;
};

export function isLocked(state: LockState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/** Minutes (rounded up) until the lock lifts; 0 when not locked. */
export function minutesUntilUnlock(state: LockState, now: Date): number {
  if (!isLocked(state, now)) return 0;
  return Math.ceil((state.lockedUntil!.getTime() - now.getTime()) / 60_000);
}

/** State after a failed attempt. Locks on the 5th consecutive failure. */
export function afterFailedAttempt(state: LockState, now: Date): LockState {
  // An expired lock starts a fresh count.
  const base =
    state.lockedUntil && state.lockedUntil.getTime() <= now.getTime() ? 0 : state.failedPinAttempts;
  const failed = base + 1;
  if (failed >= MAX_FAILED_ATTEMPTS) {
    return {
      failedPinAttempts: 0,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000),
    };
  }
  return { failedPinAttempts: failed, lockedUntil: null };
}

export function afterSuccessfulAttempt(): LockState {
  return { failedPinAttempts: 0, lockedUntil: null };
}

export function ipWindowStart(now: Date): Date {
  return new Date(now.getTime() - IP_WINDOW_MINUTES * 60_000);
}

export function isIpThrottled(recentFailures: number): boolean {
  return recentFailures >= IP_MAX_FAILURES;
}
