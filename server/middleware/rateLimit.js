const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;
const env = require("../config/env");
const { RateLimitError } = require("../utils/errors");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const POLICIES = {
  globalFlood: { windowMs: MINUTE, limit: 1000 },

  
  loginPerIp: { windowMs: 15 * MINUTE, limit: 20 }, 
  loginPerAccount: { windowMs: 15 * MINUTE, limit: 10 }, 

  register: { windowMs: HOUR, limit: 10 },

  refresh: { windowMs: 15 * MINUTE, limit: 100 },

  createLinkAnonymous: { windowMs: HOUR, limit: 20 },
  createLinkUser: { windowMs: HOUR, limit: 100 },

  manageLinks: { windowMs: MINUTE, limit: 60 },

  analytics: { windowMs: MINUTE, limit: 30 },

  redirectMisses: { windowMs: MINUTE, limit: 60 },

  passwordReset: { windowMs: HOUR, limit: 3 },
};

const byIp = (req) => ipKeyGenerator(req.ip);


const byUser = (req) => (req.user ? `user:${req.user._id}` : `ip:${byIp(req)}`);


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

function makeLimiter({ name, windowMs, limit, key = byIp, failuresOnly = false, what = "requests", store }) {
  return rateLimit({
    windowMs,
    limit: scaled(limit),
    keyGenerator: key,
    skipSuccessfulRequests: failuresOnly, // count only responses with status >= 400
    standardHeaders: true, //                RateLimit-* headers tell well-behaved clients how much is left
    legacyHeaders: false,
    store,
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
exports.analytics = limiter("analytics", { key: byUser, what: "analytics requests" });
exports.redirectMisses = limiter("redirectMisses", { failuresOnly: true, what: "requests for unknown links" });
exports.passwordReset = limiter("passwordReset", { what: "password reset requests" });


const createLinkAnonymous = limiter("createLinkAnonymous", { what: "links created" });
const createLinkUser = limiter("createLinkUser", { key: byUser, what: "links created" });
exports.createLink = (req, res, next) => (req.user ? createLinkUser : createLinkAnonymous)(req, res, next);

exports.POLICIES = POLICIES;
exports.makeLimiter = makeLimiter;
exports.keys = { byIp, byUser, byEmail };
