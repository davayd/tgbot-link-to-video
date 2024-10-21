import winston from "winston";
import moment from "moment-timezone";

const timezoned = () => {
  return moment().tz("Europe/Warsaw").format("DD.MM.YYYY HH:mm:ss");
};

export const logger = winston.createLogger({
  level: "silly",
  format: winston.format.combine(
    winston.format.timestamp({
      format: timezoned,
    }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: "debug.log" }),
    new winston.transports.Console(),
  ],
});
