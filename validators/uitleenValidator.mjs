import { body } from "express-validator";

export const uitleenValidator = [
  body("gereedschapId")
    .notEmpty().withMessage("Gereedschap ID is verplicht.")
    .isInt({ min: 1 }).withMessage("Gereedschap ID moet een geldig getal zijn."),

  body("gebruikerId")
    .notEmpty().withMessage("Gebruiker ID is verplicht.")
    .isInt({ min: 1 }).withMessage("Gebruiker ID moet een geldig getal zijn."),

  body("startDatum")
    .notEmpty().withMessage("Startdatum is verplicht.")
    .isISO8601().withMessage("Startdatum moet een geldige datum zijn (YYYY-MM-DD)."),

  body("eindDatum")
    .notEmpty().withMessage("Einddatum is verplicht.")
    .isISO8601().withMessage("Einddatum moet een geldige datum zijn (YYYY-MM-DD).")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDatum)) {
        throw new Error("Einddatum moet na de startdatum liggen.");
      }
      return true;
    }),
];