const pino = require("pino");
const env = require("./env");

const isTest = env.nodeEnv === "test";
const isDev = env.nodeEnv === "development";

// In testing, silence logs to keep test reports clean. In dev, debug level; in prod, info level.
const defaultLevel = process.env.LOG_LEVEL || (isTest ? "silent" : isDev ? "debug" : "info");

// Sensitive fields automatically masked before logs are written
const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.password",
  "password",
  "*.password",
  "token",
  "*.token",
  "secret",
  "*.secret",
  "refreshToken",
  "*.refreshToken",
];

const logger = pino({
  level: defaultLevel,
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  base: {
    service: "url-shortener",
    env: env.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    isDev && !isTest
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname,service,env",
          },
        }
      : undefined,
});

module.exports = logger;
