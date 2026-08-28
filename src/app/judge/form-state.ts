/**
 * Shapes the console's forms pass back to the browser.
 *
 * Its own module with no imports, for two reasons. First, the same one as the
 * admin equivalent: these are read by client components, and importing them
 * from `auth.ts` would pull `server-only`, the session layer and through it the
 * Postgres driver into the browser bundle.
 *
 * Second, and non-negotiable: a `"use server"` file may export async functions
 * and NOTHING else. `initialScoringFormState` is a plain object, so it cannot
 * live in `actions.ts` — putting it there makes every route in the app fail to
 * render, which is exactly how this module came to exist.
 */

export type JudgeLoginState = {
  status: "idle" | "error";
  /** Already translated, deliberately generic. Never echoes server internals. */
  message?: string;
};

export const initialJudgeLoginState: JudgeLoginState = { status: "idle" };

export type ScoringFormState = {
  status: "idle" | "error" | "saved";
  message?: string;
  /** Epoch ms of the last successful save, so a form can say when. */
  savedAt?: number;
};

export const initialScoringFormState: ScoringFormState = { status: "idle" };
