// Turns text typed by a user into a pattern that matches that text LITERALLY.
//
// Without this, searching for "a.b" would also match "axb", searching for "(" would
// crash the query, and a crafted pattern could make the database spend seconds
// on one request (ReDoS). User input must never be treated as pattern syntax.
module.exports = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
