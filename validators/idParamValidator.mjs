import { param } from "express-validator";

const idValidator = (paramName) => [
  param(paramName)
    .isInt({ min: 1 }).withMessage("ID moet een geldig positief getal zijn."),
];

export const chatIdParamValidator = idValidator("chatId");
export const userIdParamValidator = idValidator("userId");