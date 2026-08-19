/**
 * Generate the secrets this deployment needs.
 *
 *   npm run keygen
 *
 * Prints values only — nothing is written to disk, and nothing is sent
 * anywhere. Copy them into .env.local or `vercel env add`.
 */
import { randomBytes } from "node:crypto";

const secrets = [
  {
    name: "ENCRYPTION_KEY",
    value: randomBytes(32).toString("base64"),
    note: "AES-256 key for personal data at rest.",
    warning:
      "LOSE THIS AND EVERY REGISTRATION BECOMES UNREADABLE. It is not recoverable\n" +
      "  from the database — that is the point. Back it up somewhere that is neither\n" +
      "  the database nor this repository. Changing it orphans existing rows.",
  },
  {
    name: "CSRF_SECRET",
    value: randomBytes(32).toString("base64url"),
    note: "HMAC key for CSRF and form-timestamp tokens.",
    warning: "Rotating it invalidates open forms; users just reload. Safe to change.",
  },
];

console.log("\nAstanaTechCup — generated secrets\n");

for (const secret of secrets) {
  console.log(`# ${secret.note}`);
  console.log(`# ⚠ ${secret.warning}`);
  console.log(`${secret.name}=${secret.value}\n`);
}

console.log("Set them on Vercel with:\n");
for (const secret of secrets) {
  console.log(`  vercel env add ${secret.name} production`);
}
console.log(
  "\nThe admin password hash is separate — generate it with: npm run admin:hash\n",
);
