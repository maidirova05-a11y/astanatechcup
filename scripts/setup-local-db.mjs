/**
 * One-shot local development setup.
 *
 *   npm run setup:local
 *
 * Creates a dedicated role and database on your local PostgreSQL, generates
 * the secrets, and writes `.env.local`. Run it once.
 *
 * You are prompted for your PostgreSQL superuser password. It is used for this
 * connection only: never stored, never written to a file, never echoed.
 *
 * The app gets its OWN role with its own generated password rather than
 * connecting as `postgres` — a bug in this codebase should not be able to drop
 * your other databases.
 */
import { createInterface } from "node:readline";
import { randomBytes, scrypt } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env.local");

const DB_NAME = "astanatechcup";
const DB_ROLE = "astanatechcup_app";

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (hidden) {
      process.stdout.write(question);
      rl._writeToOutput = () => {};
    }

    rl.question(hidden ? "" : question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function scryptAsync(password, salt, keyLength, options) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function hashPassword(password) {
  const salt = randomBytes(32);
  const derived = await scryptAsync(password, salt, 64, {
    N: 1 << 17,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  return ["scrypt", 1 << 17, 8, 1, salt.toString("base64"), derived.toString("base64")].join("$");
}

/** Readable but high-entropy: ~130 bits, no ambiguous characters. */
function generatePassword(length = 24) {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    // Reject above the largest whole multiple of the alphabet size, so the
    // distribution stays uniform rather than biased toward early characters.
    if (bytes[i] < 256 - (256 % alphabet.length)) {
      out += alphabet[bytes[i] % alphabet.length];
    }
  }
  return out;
}

/** Postgres identifiers are not parameterisable, so validate then quote. */
function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return `"${name}"`;
}

const main = async () => {
  console.log("\nAstanaTechCup — local database setup\n");

  if (existsSync(ENV_PATH)) {
    console.log(".env.local already exists.");
    const overwrite = await prompt("Overwrite it? [y/N] ");
    if (overwrite.trim().toLowerCase() !== "y") {
      console.log("Aborted. Nothing was changed.");
      process.exit(0);
    }
  }

  const host = (await prompt("PostgreSQL host [localhost]: ")).trim() || "localhost";
  const port = (await prompt("Port [5432]: ")).trim() || "5432";
  const superUser = (await prompt("Superuser [postgres]: ")).trim() || "postgres";
  const superPassword = await prompt(`Password for ${superUser}: `, { hidden: true });

  if (!superPassword) {
    console.error("\nNo password entered. Aborting.");
    process.exit(1);
  }

  console.log("\nConnecting…");

  const admin = postgres({
    host,
    port: Number(port),
    username: superUser,
    password: superPassword,
    database: "postgres",
    max: 1,
    connect_timeout: 10,
    ssl: false,
    onnotice: () => {},
  });

  const appPassword = generatePassword();

  try {
    await admin`select 1`;
    console.log("Connected.");

    const [existingRole] = await admin`
      select 1 from pg_roles where rolname = ${DB_ROLE}
    `;

    if (existingRole) {
      console.log(`Role ${DB_ROLE} exists — resetting its password.`);
      await admin.unsafe(
        `ALTER ROLE ${quoteIdent(DB_ROLE)} WITH LOGIN PASSWORD '${appPassword.replace(/'/g, "''")}'`,
      );
    } else {
      console.log(`Creating role ${DB_ROLE}…`);
      await admin.unsafe(
        `CREATE ROLE ${quoteIdent(DB_ROLE)} WITH LOGIN PASSWORD '${appPassword.replace(/'/g, "''")}'`,
      );
    }

    const [existingDb] = await admin`
      select 1 from pg_database where datname = ${DB_NAME}
    `;

    if (existingDb) {
      console.log(`Database ${DB_NAME} already exists — keeping it.`);
    } else {
      console.log(`Creating database ${DB_NAME}…`);
      // CREATE DATABASE cannot run inside a transaction block.
      await admin.unsafe(
        `CREATE DATABASE ${quoteIdent(DB_NAME)} OWNER ${quoteIdent(DB_ROLE)} ENCODING 'UTF8'`,
      );
    }

    await admin.unsafe(
      `GRANT ALL PRIVILEGES ON DATABASE ${quoteIdent(DB_NAME)} TO ${quoteIdent(DB_ROLE)}`,
    );
  } catch (error) {
    console.error(`\nDatabase setup failed: ${error.message}`);
    if (/password authentication failed/i.test(error.message)) {
      console.error("The superuser password was not accepted.");
    }
    await admin.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  }

  await admin.end({ timeout: 5 });

  // The app role owns the database but not necessarily the public schema in
  // PostgreSQL 15+, where public is no longer writable by default.
  const appDb = postgres({
    host,
    port: Number(port),
    username: superUser,
    password: superPassword,
    database: DB_NAME,
    max: 1,
    ssl: false,
    onnotice: () => {},
  });

  try {
    await appDb.unsafe(`GRANT ALL ON SCHEMA public TO ${quoteIdent(DB_ROLE)}`);
    await appDb.unsafe(`ALTER SCHEMA public OWNER TO ${quoteIdent(DB_ROLE)}`);
  } catch (error) {
    console.warn(`Could not adjust schema ownership: ${error.message}`);
  }
  await appDb.end({ timeout: 5 });

  /* ── Secrets ──────────────────────────────────────────────────────────── */

  const csrfSecret = randomBytes(32).toString("base64url");
  const encryptionKey = randomBytes(32).toString("base64");
  const adminPassword = generatePassword(20);
  const adminHash = await hashPassword(adminPassword);

  const databaseUrl = `postgres://${DB_ROLE}:${encodeURIComponent(appPassword)}@${host}:${port}/${DB_NAME}`;

  const envBody = `# Generated by scripts/setup-local-db.mjs
# LOCAL DEVELOPMENT ONLY. Never commit this file; never reuse these values
# in production. .gitignore already excludes it.

APP_URL=http://localhost:3000

DATABASE_URL=${databaseUrl}

CSRF_SECRET=${csrfSecret}

# AES-256 key for personal data at rest. Local only — generate a separate one
# for production with: npm run keygen
ENCRYPTION_KEY=${encryptionKey}

# Local admin password is printed once by the setup script. Regenerate a real
# one for production with: npm run admin:hash
ADMIN_PASSWORD_HASH='${adminHash}'

TRUSTED_IP_HEADER=x-forwarded-for
CSP_REPORT_ONLY=0
`;

  writeFileSync(ENV_PATH, envBody, { encoding: "utf8" });

  console.log("\n" + "=".repeat(68));
  console.log("Done. .env.local written.\n");
  console.log(`  Database : ${DB_NAME} on ${host}:${port}`);
  console.log(`  Role     : ${DB_ROLE}`);
  console.log("\n  ADMIN PANEL PASSWORD (local only, shown once):\n");
  console.log(`      ${adminPassword}\n`);
  console.log("  Save it now. It is not stored anywhere in plaintext.");
  console.log("  For production, generate a different one with: npm run admin:hash");
  console.log("=".repeat(68));
  console.log("\nNext:\n  npm run db:migrate\n  npm run dev\n");
};

main().catch((error) => {
  console.error("\nSetup failed:", error.message);
  process.exit(1);
});
