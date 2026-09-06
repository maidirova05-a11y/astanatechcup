/**
 * Form state shared between the cabinet's server actions and the client
 * components that render them. Kept in its own module because a `"use client"`
 * file cannot import from a `"use server"` one except to call its actions.
 */

export type CoachFormState =
  | { status: "idle" }
  | { status: "error"; message: string; field?: "reference" | "email" | "password" };

export const initialCoachFormState: CoachFormState = { status: "idle" };
