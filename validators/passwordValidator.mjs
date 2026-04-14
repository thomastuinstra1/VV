import { body } from "express-validator";

export const wachtwoordVergetenValidator = [
  body("email")
    .notEmpty().withMessage("E-mailadres is verplicht.")
    .isEmail().withMessage("Voer een geldig e-mailadres in."),
];

export const wachtwoordResetValidator = [
  body("token")
    .notEmpty().withMessage("Token is verplicht."),

  body("password")
    .notEmpty().withMessage("Nieuw wachtwoord is verplicht.")
    .isLength({ min: 8 }).withMessage("Wachtwoord moet minimaal 8 tekens bevatten."),
];