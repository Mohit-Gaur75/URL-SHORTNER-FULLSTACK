// Fires a set of valid and invalid requests at a RUNNING server and checks the
// status codes. Usage (server must be running, MongoDB connected):
//
//   npm run check:api
//   API_URL=http://localhost:5000 node scripts/manual-check.js
//
// It makes 8 auth requests and 9 URL-creation requests, which stays inside the
// current rate limits (10 per 15 minutes each). Re-running it immediately will
// hit those limits (429); restart the server (type `rs` in nodemon) to reset.

const API = (process.env.API_URL || "http://localhost:5000").replace(/\/+$/, "");
const stamp = Date.now();

const cases = [
  ["GET", "/api/health", null, 200, "health check"],

  // ---- auth (8 requests) ----
  ["POST", "/api/auth/register", {}, 400, "register: all fields missing"],
  ["POST", "/api/auth/register", { name: "T", email: "not-an-email", password: "password123" }, 400, "register: invalid email"],
  ["POST", "/api/auth/register", { name: "T", email: "t@example.com", password: "short" }, 400, "register: password too short"],
  ["POST", "/api/auth/register", { name: "T", email: "t@example.com", password: "password123", role: "ADMIN" }, 400, "register: unknown field 'role' rejected"],
  ["POST", "/api/auth/register", { name: "  Test User ", email: `Test.${stamp}@Example.com`, password: "password123" }, 201, "register: valid (messy name/email get cleaned)"],
  ["POST", "/api/auth/login", { email: { $gt: "" }, password: { $gt: "" } }, 400, "login: NoSQL operator payload rejected"],
  ["POST", "/api/auth/login", { email: `test.${stamp}@example.com`, password: "wrong-password" }, 401, "login: wrong password"],
  ["POST", "/api/auth/login", { email: `TEST.${stamp}@example.com`, password: "password123" }, 200, "login: correct (email is case-insensitive)"],

  // ---- urls (9 requests) ----
  ["POST", "/api/urls", {}, 400, "url: empty body"],
  ["POST", "/api/urls", { originalUrl: "javascript:alert(1)" }, 400, "url: javascript: scheme"],
  ["POST", "/api/urls", { originalUrl: "ftp://example.com/file" }, 400, "url: ftp scheme"],
  ["POST", "/api/urls", { originalUrl: `${API}/abc` }, 400, "url: points at this service"],
  ["POST", "/api/urls", { originalUrl: "https://example.com", customCode: "admin" }, 400, "url: reserved custom code"],
  ["POST", "/api/urls", { originalUrl: "https://example.com", customCode: "has space" }, 400, "url: custom code with a space"],
  ["POST", "/api/urls", { originalUrl: " https://example.com/valid ", customCode: "" }, 201, "url: valid, random code (empty customCode = none)"],
  ["POST", "/api/urls", { originalUrl: "https://example.com/custom", customCode: `t${stamp}` }, 201, "url: valid with custom code"],
  ["POST", "/api/urls", { originalUrl: "https://example.com/custom", customCode: `t${stamp}` }, 409, "url: same custom code again"],

  // ---- redirect (not rate limited) ----
  ["GET", `/t${stamp}`, null, 302, "redirect: the custom code created above"],
  ["GET", "/definitely-not-a-code", null, 404, "redirect: unknown code"],
];

(async () => {
  let failed = 0;
  for (const [method, path, body, expected, label] of cases) {
    let status, text;
    try {
      const res = await fetch(API + path, {
        method,
        redirect: "manual",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      status = res.status;
      text = res.status === 302 ? `→ ${res.headers.get("location")}` : await res.text();
    } catch (err) {
      console.error(`Cannot reach ${API}: ${err.message}. Is the server running?`);
      process.exit(1);
    }
    const pass = status === expected;
    if (!pass) failed++;
    let shown = text;
    try {
      const j = JSON.parse(text);
      shown = j.message || (j.user ? "ok" : j.shortUrl) || text;
    } catch {}
    console.log(`${pass ? "PASS" : "FAIL"}  ${String(status).padEnd(3)} (want ${expected})  ${label}\n          ${String(shown).slice(0, 110)}`);
  }
  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})();
