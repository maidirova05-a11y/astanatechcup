/**
 * Shape of the registration action's result.
 *
 * Kept in its own module because a `"use server"` file may only export async
 * functions — Next.js turns every export into a callable server reference, so
 * a plain object or type living next to the action fails the build with
 * "A 'use server' file can only export async functions".
 */

export type RegisterState = {
  status: "idle" | "success" | "error";
  /** Message key under `registration.*`. Never raw server text. */
  message?: string;
  /** Field path → key under `registration.validation.*`. */
  fieldErrors?: Record<string, string>;
  /** Interpolation values for a field error, e.g. `{ members: { max: 3 } }`. */
  fieldErrorParams?: Record<string, Record<string, string | number>>;
  reference?: string;
  email?: string;
  checkoutUrl?: string;
  /** True when the entry was saved but no payment provider is configured. */
  paymentDeferred?: boolean;
};

export const initialRegisterState: RegisterState = { status: "idle" };
