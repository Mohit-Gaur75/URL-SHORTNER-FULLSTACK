const { z } = require("zod");
const { bodyTypeError } = require("./common");

const name = z
  .string({ error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(50, "Name must be 50 characters or fewer");

// REGISTRATION is strict: we only create accounts with a well-formed email.
const registerEmail = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .pipe(z.email("Enter a valid email address"));

// bcrypt only uses the first 72 BYTES of a password, and an emoji is 4 bytes,
// so we count bytes, not characters.
const registerPassword = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password is too long (maximum 72 bytes)"
  );

const registerBody = z.strictObject(
  { name, email: registerEmail, password: registerPassword },
  { error: bodyTypeError }
);

// LOGIN is lenient: it looks up an existing account, so it must accept every
// email we ever allowed at registration, including accounts created before
// these rules existed. It only guarantees "a string of sane size", which is
// also what blocks NoSQL operator payloads like { "$gt": "" }.
const loginEmail = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(254, "Email is too long");

const loginPassword = z
  .string({ error: "Password is required" })
  .min(1, "Password is required")
  .max(256, "Password is too long");

const loginBody = z.strictObject(
  { email: loginEmail, password: loginPassword },
  { error: bodyTypeError }
);

module.exports = { registerBody, loginBody };
