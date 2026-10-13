// The ONLY file that knows how passwords are hashed. bcrypt is deliberately slow
// (cost 12 ≈ a quarter of a second), so guessing millions of passwords from a
// stolen database is impractical.
//
// Native bcrypt does the hashing on a worker thread. The pure-JavaScript
// fallback (bcryptjs) runs ON the server's main thread: while it hashes, nothing
// else, including redirects, gets served. We measured stalls of ~200 ms for
// two simultaneous logins. Both produce compatible hashes, so existing users
// keep working with either.
let engine;
try {
  engine = require("bcrypt");
} catch {
  engine = require("bcryptjs");
  if (process.env.NODE_ENV !== "test") {
    console.warn("⚠️  Native bcrypt is not installed; using bcryptjs, which blocks the server while hashing. Run: npm install bcrypt");
  }
}

const COST = 12;

const hashPassword = (plain) => engine.hash(plain, COST);
const verifyPassword = (plain, hash) => engine.compare(plain, hash);

// A valid cost-12 hash of a random string nobody knows. Login compares against
// it when the email doesn't exist, so "no such user" takes as long as "wrong
// password" and the response time can't be used to discover registered emails.
const DUMMY_HASH = "$2b$12$75pstEVNaXSeAJ4cK8AlCOiwcI1lVSaRoEDUii7BsyQ3b4Z/Upvi.";

module.exports = { hashPassword, verifyPassword, DUMMY_HASH };
