// Tells browsers and shared caches (CDNs, proxies) never to store this response.
//
// Why it matters for a short link: a cached redirect means the NEXT visit never
// reaches our server, so it wouldn't be counted, and an expired, disabled or
// deleted link would keep working for anyone who had it cached.
module.exports = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
