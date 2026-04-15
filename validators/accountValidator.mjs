import { body } from "express-validator";

export const updateAccountValidator = [
  body("Name")
    .optional()
    .isLength({ max: 100 }).withMessage("Naam mag maximaal 100 tekens zijn."),

  body("E_mail")
    .optional()
    .isEmail().withMessage("Voer een geldig e-mailadres in."),

  body("Postcode")
    .optional()
    .matches(/^[1-9][0-9]{3}\s?[A-Za-z]{2}$/).withMessage("Voer een geldige Nederlandse postcode in."),

  body("Password")
    .optional()
    .isLength({ min: 8 }).withMessage("Wachtwoord moet minimaal 8 tekens bevatten."),

  body("BSN")
    .optional()
    .matches(/^\d{8,9}$/).withMessage("Voer een geldig BSN in (8 of 9 cijfers)."),
];