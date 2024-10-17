import winston from "winston";

const LOG_INFO = process.env.LOG_INFO || false;

const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "debug.log" }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

export { logger, LOG_INFO };
