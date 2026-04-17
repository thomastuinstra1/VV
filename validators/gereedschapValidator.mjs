import { body } from "express-validator";

export const gereedschapValidator = [
  body("Naam")
    .notEmpty().withMessage("Naam van het gereedschap is verplicht.")
    .isLength({ max: 150 }).withMessage("Naam mag maximaal 150 tekens zijn."),

  body("Beschrijving")
    .optional()
    .isLength({ max: 1000 }).withMessage("Beschrijving mag maximaal 1000 tekens zijn."),

  body("BorgBedrag")
    .optional()
    .isFloat({ min: 0 }).withMessage("Borgbedrag moet een positief getal zijn."),

  body("Begindatum")
    .optional()
    .isISO8601().withMessage("Begindatum moet een geldige datum zijn."),

  body("Einddatum")
    .optional()
    .isISO8601().withMessage("Einddatum moet een geldige datum zijn."),

  body("categorieen")
    .optional()
    .isArray().withMessage("Categorieën moet een array zijn."),
];