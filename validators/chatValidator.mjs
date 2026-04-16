import { body } from "express-validator";

export const chatStartValidator = [
  body("partnerId")
    .notEmpty().withMessage("Partner ID is verplicht.")
    .isInt({ min: 1 }).withMessage("Partner ID moet een geldig getal zijn."),

  body("toolId")
    .notEmpty().withMessage("Tool ID is verplicht.")
    .isInt({ min: 1 }).withMessage("Tool ID moet een geldig getal zijn."),
];