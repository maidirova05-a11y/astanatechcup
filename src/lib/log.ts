/**
 * Structured logging with PII redaction enforced at the logger.
 *
 * The whole point: redaction is NOT a convention that every call site has to
 * remember. `logger.info("registration.created", { email, members })` cannot
 * leak, because the serialiser strips sensitive keys on the way out. The
 * audience here is schoolchildren — their names, ages, phone numbers and email
 * addresses must never end up in a log aggregator.
 */

import { isDevelopment } from "@/lib/env";

type Level = "debug" | "info" | "warn" | "error";

/** Keys whose values are replaced with a redaction marker, matched case-insensitively. */
const SENSITIVE_KEYS = [
  "email",
  "phone",
  "name",
  "firstname",
  "lastname",
  "fullname",
  "teamname",
  "age",
  "birthdate",
  "dob",
  "address",
  "comment",
  "members",
  "organization",
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "csrf",
  "signature",
  "card",
  "iin",
];

const SENSITIVE_PATTERN = new RegExp(`(${SENSITIVE_KEYS.join("|")})`, "i");

/** Catch PII that arrives inside a free-text string rather than a named field. */
const EMAIL_IN_TEXT = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_IN_TEXT = /(?:\+?\d[\d\s()-]{8,}\d)/g;

const MAX_DEPTH = 6;

function redactString(value: string): string {
  return value
    .replace(EMAIL_IN_TEXT, "[email]")
    .replace(PHONE_IN_TEXT, "[phone]");
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[depth-limit]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      // Stacks can contain interpolated user input from thrown messages.
      stack: isDevelopment && value.stack ? redactString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_PATTERN.test(key)) {
        out[key] = describeRedacted(item);
      } else {
        out[key] = redact(item, depth + 1);
      }
    }
    return out;
  }

  return "[unserialisable]";
}

/**
 * Keep the *shape* of redacted data — "3 members were submitted" is useful for
 * debugging, "Aisha, 12" is a privacy incident.
 */
function describeRedacted(value: unknown): string {
  if (value === null || value === undefined) return "[redacted:empty]";
  if (Array.isArray(value)) return `[redacted:${value.length} items]`;
  if (typeof value === "string") return `[redacted:${value.length} chars]`;
  if (typeof value === "number") return "[redacted:number]";
  return "[redacted]";
}

export type LogContext = Record<string, unknown>;

function emit(level: Level, event: string, context?: LogContext) {
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(context ? (redact(context) as LogContext) : {}),
  };

  const line = isDevelopment ? formatForHuman(record) : JSON.stringify(record);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function formatForHuman(record: Record<string, unknown>): string {
  const { ts, level, event, ...rest } = record;
  const detail = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
  return `[${String(ts).slice(11, 19)}] ${String(level).toUpperCase().padEnd(5)} ${event}${detail}`;
}

export const logger = {
  debug: (event: string, context?: LogContext) =>
    isDevelopment && emit("debug", event, context),
  info: (event: string, context?: LogContext) => emit("info", event, context),
  warn: (event: string, context?: LogContext) => emit("warn", event, context),
  error: (event: string, context?: LogContext) => emit("error", event, context),
};

/**
 * Security events worth alerting on. Split from the general logger so they are
 * trivially greppable and can be routed to a different sink.
 */
export const securityLog = {
  csrfFailure: (context: LogContext) => emit("warn", "security.csrf_failure", context),
  originMismatch: (context: LogContext) => emit("warn", "security.origin_mismatch", context),
  rateLimited: (context: LogContext) => emit("warn", "security.rate_limited", context),
  captchaFailure: (context: LogContext) => emit("warn", "security.captcha_failure", context),
  honeypotTripped: (context: LogContext) => emit("warn", "security.honeypot", context),
  webhookSignatureFailure: (context: LogContext) =>
    emit("error", "security.webhook_signature_failure", context),
  validationRejected: (context: LogContext) =>
    emit("info", "security.validation_rejected", context),
  deadlineRejected: (context: LogContext) => emit("info", "security.deadline_rejected", context),
};
