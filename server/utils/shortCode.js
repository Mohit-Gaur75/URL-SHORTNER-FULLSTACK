const { customAlphabet } = require("nanoid");

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const generate = customAlphabet(ALPHABET, 7); // 62^7 ≈ 3.5 trillion combos

const CODE_RE = /^[A-Za-z0-9_-]{3,30}$/;

const RESERVED = new Set([
  "api", "login", "register", "dashboard", "unlock", "stats",
  "admin", "health", "about", "static", "assets",
]);

const isValidCode = (code) => CODE_RE.test(code);
const isReserved = (code) => RESERVED.has(code.toLowerCase());

module.exports = { generate, isValidCode, isReserved };