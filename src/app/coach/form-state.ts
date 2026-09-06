/**
 * Form state shared between the cabinet's server actions and the client
 * components that render them. Kept in its own module because a `"use client"`
 * file cannot import from a `"use server"` one except to call its actions.
 */

/**
 * `values` exists because React 19 resets an uncontrolled form after a form
 * action completes. On a sign-in guarded by a five-try lockout, making someone
 * retype their address every time they fumble the password is how you spend
 * those five tries. Passwords are deliberately NOT echoed back.
 */
export type CoachFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      field?: "reference" | "email" | "password";
      values?: { email?: string; reference?: string };
    };

export const initialCoachFormState: CoachFormState = { status: "idle" };
