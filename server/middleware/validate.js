const { ValidationError } = require("../utils/errors");

// validate({ body, params, query }) → middleware.
//
// Each value is a Zod schema. Valid, cleaned data is placed on req.validated;
// controllers must read from there, never from the raw req.body/query/params.
// (In Express 5, req.query is read-only, so we can't overwrite it anyway.)
module.exports = (schemas) => (req, res, next) => {
  const validated = {};
  const details = [];

  for (const location of ["params", "query", "body"]) {
    const schema = schemas[location];
    if (!schema) continue;

    // req.body is undefined when the client sent no JSON, so treat it as {}
    const input = location === "body" ? (req.body ?? {}) : req[location];
    const result = schema.safeParse(input);

    if (result.success) {
      validated[location] = result.data;
    } else {
      for (const issue of result.error.issues) {
        details.push({
          in: location,
          // For an unknown key the path is empty; the key names are in `keys`
          field: issue.path.join(".") || issue.keys?.join(", ") || location,
          message: issue.message,
        });
      }
    }
  }

  if (details.length > 0) {
    // The error handler turns this into the standard error envelope:
    // code VALIDATION_ERROR, with one entry in `details` per problem.
    throw new ValidationError(details);
  }

  req.validated = validated;
  next();
};
