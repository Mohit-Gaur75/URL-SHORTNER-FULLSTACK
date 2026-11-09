/**
 * HTTP Parameter Pollution (HPP) Defense.
 * Express parses repeated query keys (?sort=a&sort=b) into arrays (['a', 'b']).
 * Unless an array is explicitly expected, repeated parameters can break string operations
 * or bypass type checks. This middleware flattens duplicated query parameters to the last value.
 */
function preventHpp(req, res, next) {
  if (req.query && typeof req.query === "object") {
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        req.query[key] = value[value.length - 1]; // select the last occurrence
      }
    }
  }
  next();
}

module.exports = preventHpp;
