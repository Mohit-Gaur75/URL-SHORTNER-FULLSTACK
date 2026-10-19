const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;
const env = require("../config/env");
const { RateLimitError } = require("../utils/errors");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// ---------------------------------------------------------------------------
// THE POLICIES. Every limit in the app is in this one table.
//
// One global limit can't work: logging in needs a tight limit (guessing
// passwords), browsing your own dashboard needs a loose one, and following a
// short link must never be limited at all unless the visitor is scanning.
// Each row below says what attack it exists for.
// ---------------------------------------------------------------------------
const POLICIES = {
  // Safety net for any API traffic from one address. Not a real policy.
  globalFlood: { windowMs: MINUTE, limit: 1000 },

  // Password guessing, two angles. Only FAILED logins count.
  loginPerIp: { windowMs: 15 * MINUTE, limit: 20 }, //      one machine trying many accounts (credential stuffing)
  loginPerAccount: { windowMs: 15 * MINUTE, limit: 10 }, // many machines trying one account (distributed guessing)

  // Account farming and CPU burn: every registration costs a password hash.
  register: { windowMs: HOUR, limit: 10 },

  // Refreshing happens on every page load, so it needs a roomy limit.
  refresh: { windowMs: 15 * MINUTE, limit: 100 },

  // Spam and phishing links. Anonymous visitors get less than people with accounts,
  // and accounts are counted PER USER, not per IP: a campus or an office shares one IP.
  createLinkAnonymous: { windowMs: HOUR, limit: 20 },
  createLinkUser: { windowMs: HOUR, limit: 100 },

  // Viewing, editing and deleting your own links: per user.
  manageLinks: { windowMs: MINUTE, limit: 60 },

  // Scanning for valid short codes. Only MISSES (404/410) count, so normal
  // visitors, who succeed, are never affected.
  redirectMisses: { windowMs: MINUTE, limit: 60 },

  // Not attached yet: there is no password-reset endpoint. When there is, it
  // gets the strictest limit of all: each request sends an email, and the
  // endpoint is a tempting way to find out which emails have accounts.
  passwordReset: { windowMs: HOUR, limit: 3 },
};

// ---- who is being counted ---------------------------------------------------
// IPv6 clients can switch addresses freely within their /64 block, so ipKeyGenerator
// groups them. Without it one attacker would look like billions of visitors.
const byIp = (req) => ipKeyGenerator(req.ip);

// The signed-in user, falling back to the IP if there is none.
const byUser = (req) => (req.user ? `user:${req.user._id}` : `ip:${byIp(req)}`);

// The account being attacked. The email is normalized exactly like the login
// does, so "A@x.com" and " a@x.com" are the same account. This works for emails
// that don't exist too, so the limit can't be used to learn which accounts do.
const byEmail = (req) => {
  const email = req.body?.email;
  return typeof email === "string" && email.trim()
    ? `email:${email.trim().toLowerCase().slice(0, 254)}`
    : `ip:${byIp(req)}`;
};

const scaled = (limit) => Math.max(1, Math.round(limit * env.rateLimitMultiplier));

function waitText(resetTime) {
  const seconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
  return seconds < 90 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`;
}

// `store` is the one place to change when we outgrow a single server: the default
// keeps counters in this process's memory, which means (1) a restart forgets
// everyone, and (2) with three servers behind a load balancer each keeps its own
// count, so the real limit is three times higher. Phase 14 introduces Redis as
// a shared store.
function makeLimiter({ name, windowMs, limit, key = byIp, failuresOnly = false, what = "requests", store }) {
  return rateLimit({
    windowMs,
    limit: scaled(limit),
    keyGenerator: key,
    skipSuccessfulRequests: failuresOnly, // count only responses with status >= 400
    standardHeaders: true, //                RateLimit-* headers tell well-behaved clients how much is left
    legacyHeaders: false,
    store,
    // Passing an error to next() sends it through the same error handler as
    // everything else, so a 429 has the standard error format.
    handler: (req, res, next) => {
      if (env.nodeEnv !== "test") {
        console.warn("[rate-limit]", JSON.stringify({ policy: name, requestId: req.id, method: req.method, path: req.originalUrl.split("?")[0] }));
      }
      next(new RateLimitError(`Too many ${what}. Try again in ${waitText(req.rateLimit.resetTime)}.`));
    },
  });
}

const limiter = (name, options) => makeLimiter({ name, ...POLICIES[name], ...options });

// ---- the limiters used by the routes -----------------------------------------
exports.globalFlood = limiter("globalFlood");
exports.loginPerIp = limiter("loginPerIp", { failuresOnly: true, what: "failed login attempts" });
exports.loginPerAccount = limiter("loginPerAccount", { key: byEmail, failuresOnly: true, what: "failed login attempts for this account" });
exports.register = limiter("register", { what: "sign-up attempts" });
exports.refresh = limiter("refresh");
exports.manageLinks = limiter("manageLinks", { key: byUser });
exports.redirectMisses = limiter("redirectMisses", { failuresOnly: true, what: "requests for unknown links" });
exports.passwordReset = limiter("passwordReset", { what: "password reset requests" });

// Creating a link: the limit depends on WHO is asking. (Place this after
// optionalAuthenticate, so req.user is already known.)
const createLinkAnonymous = limiter("createLinkAnonymous", { what: "links created" });
const createLinkUser = limiter("createLinkUser", { key: byUser, what: "links created" });
exports.createLink = (req, res, next) => (req.user ? createLinkUser : createLinkAnonymous)(req, res, next);

// Exposed for tests and for the demo script.
exports.POLICIES = POLICIES;
exports.makeLimiter = makeLimiter;
exports.keys = { byIp, byUser, byEmail };
