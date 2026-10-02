const mongoose = require("mongoose");
const { AppError } = require("./errors");

const result = (statusCode, code, message, details = [], isOperational = true) => ({
  statusCode,
  code,
  message,
  details,
  isOperational,
});

// MongoDB / Mongoose failures that mean "the database can't be reached right
// now", as opposed to "your query was wrong".
const isDatabaseUnavailable = (err) =>
  /ServerSelection|MongoNetwork|MongoNotConnected|MongoTopologyClosed/.test(err.name) ||
  /buffering timed out/.test(err.message);

// Turns ANYTHING that was thrown into one predictable shape. This is the only
// place that knows about the quirks of body-parser, Mongoose and MongoDB, so
// controllers and services never have to.
function normalizeError(thrown) {
  const err = thrown instanceof Error ? thrown : new Error(String(thrown));

  // 1. Errors we threw on purpose
  if (err instanceof AppError) {
    return result(err.statusCode, err.code, err.message, err.details);
  }

  // 2. Request-body problems raised by express.json()
  if (err.type === "entity.parse.failed") {
    return result(400, "INVALID_JSON", "Request body is not valid JSON");
  }
  if (err.type === "entity.too.large") {
    return result(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  if (err.expose === true && err.statusCode >= 400 && err.statusCode < 500) {
    return result(err.statusCode, "BAD_REQUEST", "The request could not be processed");
  }

  // 3. Mongoose: a value couldn't be cast, e.g. findById("abc")
  if (err instanceof mongoose.Error.CastError) {
    const isId = err.path === "_id";
    return result(
      400,
      isId ? "INVALID_ID" : "INVALID_VALUE",
      isId ? "Invalid identifier" : "Invalid value",
      [{ field: err.path, message: `Invalid value for '${err.path}'` }]
    );
  }

  // 4. Mongoose schema validation (a backstop: Zod normally catches this first)
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return result(400, "VALIDATION_ERROR", "Invalid request", details);
  }

  // 5. MongoDB unique index violation. We report WHICH field, never the value.
  if (err.code === 11000) {
    const details = Object.keys(err.keyPattern || {}).map((field) => ({
      field,
      message: "Already in use",
    }));
    return result(409, "DUPLICATE_KEY", "A record with this value already exists", details);
  }

  // 6. The database is unreachable: not the client's fault, and retryable
  if (isDatabaseUnavailable(err)) {
    return result(503, "DATABASE_UNAVAILABLE", "Service temporarily unavailable");
  }

  // 7. Any other database error is a bug or an incident
  if (/^Mongo/.test(err.name)) {
    return result(500, "DATABASE_ERROR", "A database error occurred", [], false);
  }

  // 8. Everything else is a programming error. The client gets NOTHING about it.
  return result(500, "INTERNAL_ERROR", "Something went wrong", [], false);
}

module.exports = { normalizeError };
