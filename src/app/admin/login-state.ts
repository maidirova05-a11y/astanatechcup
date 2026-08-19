/**
 * Shape of the login action's result.
 *
 * Deliberately in its own module with no imports. `LoginForm` is a client
 * component, and importing this from `auth.ts` would drag that module's
 * transitive dependencies — `server-only`, the session layer, and through it
 * the Postgres driver — into the browser bundle. Next.js fails the build when
 * that happens, which is the correct outcome but an obscure error to read.
 */

export type LoginState = {
  status: "idle" | "error";
  /** Already-translated, deliberately generic. Never echoes server internals. */
  message?: string;
};

export const initialLoginState: LoginState = { status: "idle" };
