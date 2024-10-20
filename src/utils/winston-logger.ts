import winston from "winston";
import moment from "moment-timezone";

const LOG_DEBUG = process.env.LOG_DEBUG || false;

const timezoned = () => {
  return moment().tz("Europe/Warsaw").format("DD.MM.YYYY HH:mm:ss");
};

const logger = winston.createLogger({
  level: 'silly',
  format: winston.format.combine(
    winston.format.timestamp({
      format: timezoned,
    }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "debug.log" }),
    new winston.transports.Console(),
  ],
});

export { logger, LOG_DEBUG };
