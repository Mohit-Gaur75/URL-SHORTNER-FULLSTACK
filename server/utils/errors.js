// Operational errors: problems we EXPECT can happen while the app is running
// correctly (bad input, wrong password, missing record, taken alias...).
// Anything thrown that is NOT an AppError is treated as a bug.
class AppError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode; // HTTP status
    this.code = code; //             stable, machine-readable (clients branch on this)
    this.details = details; //       optional field-level info
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(details = [], message = "Invalid request") {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHENTICATED") {
    super(401, code, message);
  }
}

class AuthorizationError extends AppError {
  constructor(message = "You don't have permission to do that", code = "FORBIDDEN") {
    super(403, code, message);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(404, code, message);
  }
}

// 410 = "this existed, and was deliberately taken away". Different from 404
// ("nothing here, maybe never was"): it tells clients and search engines to
// stop asking.
class GoneError extends AppError {
  constructor(message = "This resource is no longer available", code = "GONE") {
    super(410, code, message);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflict", code = "CONFLICT") {
    super(409, code, message);
  }
}

class RateLimitError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(429, "RATE_LIMITED", message);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  GoneError,
  ConflictError,
  RateLimitError,
};
