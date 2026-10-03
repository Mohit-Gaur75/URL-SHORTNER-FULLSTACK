// Fires a set of valid and invalid requests at a RUNNING server and checks the
// status code AND the machine-readable error code of each answer.
//
//   npm run check:api
//   API_URL=http://localhost:5000 node scripts/manual-check.js
//
// It makes 8 auth requests and 10 URL-creation requests, which stays inside the
// current rate limits (10 per 15 minutes each). Re-running it immediately will
// hit those limits (429); restart the server (type `rs` in nodemon) to reset.

const API = (process.env.API_URL || "http://localhost:5000").replace(/\/+$/, "");
const stamp = Date.now();
const EXPIRES = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const ctx = { token: null }; // filled in by the login check, used by the owned-link checks
const AUTH = () => ({ Authorization: `Bearer ${ctx.token}` });

// [method, path, body, expected status, expected error code (or null), label, extra headers]
const cases = [
  ["GET", "/api/health", null, 200, null, "health check"],
  ["GET", "/api/does-not-exist", null, 404, "ROUTE_NOT_FOUND", "unknown route (used to be an HTML page)"],
  ["POST", "/api/auth/register", "{bad json", 400, "INVALID_JSON", "malformed JSON body"],
  ["GET", "/api/auth/me", null, 401, "UNAUTHENTICATED", "me: no token"],
  ["GET", "/api/auth/me", null, 401, "INVALID_TOKEN", "me: garbage token", { Authorization: "Bearer garbage" }],

  // ---- auth (8 requests) ----
  ["POST", "/api/auth/register", {}, 400, "VALIDATION_ERROR", "register: all fields missing"],
  ["POST", "/api/auth/register", { name: "T", email: "not-an-email", password: "password123" }, 400, "VALIDATION_ERROR", "register: invalid email"],
  ["POST", "/api/auth/register", { name: "T", email: "t@example.com", password: "short" }, 400, "VALIDATION_ERROR", "register: password too short"],
  ["POST", "/api/auth/register", { name: "T", email: "t@example.com", password: "password123", role: "ADMIN" }, 400, "VALIDATION_ERROR", "register: unknown field 'role' rejected"],
  ["POST", "/api/auth/register", { name: "  Test User ", email: `Test.${stamp}@Example.com`, password: "password123" }, 201, null, "register: valid"],
  ["POST", "/api/auth/login", { email: { $gt: "" }, password: { $gt: "" } }, 400, "VALIDATION_ERROR", "login: NoSQL operator payload rejected"],
  ["POST", "/api/auth/login", { email: `test.${stamp}@example.com`, password: "wrong-password" }, 401, "INVALID_CREDENTIALS", "login: wrong password"],
  ["POST", "/api/auth/login", { email: `TEST.${stamp}@example.com`, password: "password123" }, 200, null, "login: correct (email is case-insensitive)"],

  // ---- urls (10 requests) ----
  ["POST", "/api/urls", { originalUrl: "javascript:alert(1)" }, 400, "VALIDATION_ERROR", "url: javascript: scheme"],
  ["POST", "/api/urls", { originalUrl: `${API}/abc` }, 400, "VALIDATION_ERROR", "url: points at this service"],
  ["POST", "/api/urls", { originalUrl: "https://paypal.com@evil.example/login" }, 400, "VALIDATION_ERROR", "url: credentials hidden in the URL"],
  ["POST", "/api/urls", { originalUrl: "https://example.com", customCode: "Support" }, 400, "VALIDATION_ERROR", "url: reserved word (any letter case)"],
  ["POST", "/api/urls", { originalUrl: "https://example.com", expiresAt: "2020-01-01" }, 400, "VALIDATION_ERROR", "url: expiry in the past"],
  ["POST", "/api/urls", { originalUrl: " https://example.com/valid ", customCode: "" }, 201, null, "url: valid, random code"],
  ["POST", "/api/urls", { originalUrl: "https://example.com/custom", customCode: `t${stamp}`, expiresAt: EXPIRES }, 201, null, "url: owned custom alias with an expiry", AUTH],
  ["POST", "/api/urls", { originalUrl: "https://example.com/custom", customCode: `t${stamp}`, expiresAt: EXPIRES }, 200, null, "url: SAME request again → 200, the same link (safe retry)", AUTH],
  ["POST", "/api/urls", { originalUrl: "https://example.com/DIFFERENT", customCode: `t${stamp}`, expiresAt: EXPIRES }, 409, "SHORT_CODE_TAKEN", "url: same alias, different destination", AUTH],
  ["POST", "/api/urls", () => ({ originalUrl: "https://example.com/expiring", customCode: `x${stamp}`, expiresAt: new Date(Date.now() + 3000).toISOString() }), 201, null, "url: a link that expires in 3 seconds"],

  // ---- redirect (not rate limited) ----
  ["GET", `/t${stamp}`, null, 302, null, "redirect: GET answers 302 and is never cacheable", undefined, { header: ["cache-control", "no-store"] }],
  ["HEAD", `/t${stamp}`, null, 302, null, "redirect: HEAD answers 302 too (and counts no click)"],
  ["GET", `/x${stamp}`, null, 302, null, "redirect: the expiring link still works"],
  ["GET", "/definitely-not-a-code", null, 404, "URL_NOT_FOUND", "redirect: unknown code"],
  ["GET", `/x${stamp}`, null, 410, "LINK_EXPIRED", "redirect: after it expires → 410 Gone", undefined, { wait: 3500, header: ["cache-control", "no-store"] }],
];

(async () => {
  let failed = 0;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (const [method, path, rawBody, wantStatus, wantCode, label, extraHeaders, opts] of cases) {
    if (opts?.wait) await sleep(opts.wait);
    const body = typeof rawBody === "function" ? rawBody() : rawBody;
    let res, text;
    try {
      const raw = typeof body === "string";
      res = await fetch(API + path, {
        method,
        redirect: "manual",
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(typeof extraHeaders === "function" ? extraHeaders() : extraHeaders),
        },
        body: body ? (raw ? body : JSON.stringify(body)) : undefined,
      });
      text = res.status === 302 ? `→ ${res.headers.get("location")}` : await res.text();
    } catch (err) {
      console.error(`Cannot reach ${API}: ${err.message}. Is the server running?`);
      process.exit(1);
    }

    let json = null;
    try { json = JSON.parse(text); } catch {}
    if (json?.token) ctx.token = json.token;

    let problem = "";
    if (res.status !== wantStatus) problem = `status ${res.status}, wanted ${wantStatus}`;
    else if (wantCode && json?.error?.code !== wantCode) problem = `error code ${json?.error?.code}, wanted ${wantCode}`;
    else if (wantCode && (json.success !== false || !json.requestId)) problem = "error body is missing success:false or requestId";
    else if (opts?.header && !res.headers.get(opts.header[0])?.includes(opts.header[1])) problem = `header ${opts.header[0]} should contain "${opts.header[1]}"`;

    if (problem) failed++;
    const shown = json?.error
      ? `${json.error.code}: ${json.error.details?.[0]?.message || json.error.message}`
      : json?.shortUrl || (json?.user ? "ok" : text);
    console.log(
      `${problem ? "FAIL" : "PASS"}  ${String(res.status).padEnd(3)}  ${label}\n          ${String(shown).slice(0, 100)}${problem ? `\n          >> ${problem}` : ""}`
    );
  }
  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})();
