/**
 * Generate the ADMIN_PASSWORD_HASH value for .env.local / Vercel.
 *
 *   npm run admin:hash
 *
 * The password is read from a hidden prompt (never echoed, never in your shell
 * history, never in an argv that shows up in `ps`). Only the resulting hash is
 * printed — the plaintext never leaves this process.
 *
 * Run it yourself. Nobody else should ever type or see this password.
 */
import { createInterface } from "node:readline";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const PARAMS = { N: 1 << 17, r: 8, p: 1, keyLength: 64, saltLength: 32 };

/** Minimum that makes offline cracking of a leaked hash impractical. */
const MIN_LENGTH = 16;

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (hidden) {
      // Silence readline's echo entirely. No asterisks, no cursor tricks --
      // nothing is drawn, so nothing is left on screen or in a scrollback
      // buffer. The prompt itself is written before echo is disabled.
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

function assessStrength(password) {
  const problems = [];
  if (password.length < MIN_LENGTH) {
    problems.push(`shorter than ${MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    problems.push("no mix of upper and lower case");
  }
  if (!/\d/.test(password)) problems.push("no digits");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("no symbols");
  return problems;
}

const main = async () => {
  console.log("\nAstanaTechCup — admin password hash generator");
  console.log("The password is not echoed and is never written to disk.\n");

  const password = await prompt("Password: ", { hidden: true });

  if (!password) {
    console.error("\nNo password entered. Nothing generated.");
    process.exit(1);
  }

  const confirmation = await prompt("Repeat:   ", { hidden: true });

  if (password !== confirmation) {
    console.error("\nThe two entries do not match. Nothing generated.");
    process.exit(1);
  }

  const problems = assessStrength(password);
  if (problems.length > 0) {
    console.warn("\n⚠ Weak password:");
    for (const problem of problems) console.warn(`  · ${problem}`);
    console.warn(
      "\nThis single password protects the personal data of every child who\n" +
        "enters the championship. Consider a passphrase from a password manager.",
    );
    const proceed = await prompt("\nGenerate anyway? [y/N] ");
    if (proceed.trim().toLowerCase() !== "y") {
      console.error("Aborted.");
      process.exit(1);
    }
  }

  const salt = randomBytes(PARAMS.saltLength);
  const derived = await scryptAsync(password, salt, PARAMS.keyLength, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: 256 * 1024 * 1024,
  });

  const hash = [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");

  console.log("\nAdd this line to .env.local, and set the same value in Vercel:\n");
  console.log(`ADMIN_PASSWORD_HASH='${hash}'`);
  console.log(
    "\nUse single quotes — the hash contains $ characters that a shell would\n" +
      "otherwise try to expand.\n",
  );
};

main().catch((error) => {
  console.error("Failed to generate hash:", error.message);
  process.exit(1);
});
