const { customAlphabet } = require("nanoid");

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const generate = customAlphabet(ALPHABET, 7); // 62^7 ≈ 3.5 trillion combos

const CODE_RE = /^[A-Za-z0-9_-]{3,30}$/;

const RESERVED = new Set([
  "api", "login", "logout", "register", "signup", "signin", "dashboard",
  "settings", "account", "profile", "unlock", "stats",
  "health", "status", "admin", "static", "assets", "public", "root",
  "about", "help", "support", "contact", "terms", "privacy", "docs", "blog",
  "pricing", "www", "mail", "app", "null", "undefined",
]);

const isValidCode = (code) => CODE_RE.test(code);
const isReserved = (code) => RESERVED.has(code.toLowerCase());

module.exports = { generate, isValidCode, isReserved };
