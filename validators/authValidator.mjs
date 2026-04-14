import { body } from "express-validator";

export const registerValidator = [
  body("Name")
    .notEmpty().withMessage("Naam is verplicht.")
    .isLength({ max: 100 }).withMessage("Naam mag maximaal 100 tekens zijn."),

  body("E_mail")
    .notEmpty().withMessage("E-mailadres is verplicht.")
    .isEmail().withMessage("Voer een geldig e-mailadres in."),

  body("Password")
    .notEmpty().withMessage("Wachtwoord is verplicht.")
    .isLength({ min: 8 }).withMessage("Wachtwoord moet minimaal 8 tekens bevatten."),

  body("Postcode")
    .notEmpty().withMessage("Postcode is verplicht.")
    .matches(/^[1-9][0-9]{3}\s?[A-Za-z]{2}$/).withMessage("Voer een geldige Nederlandse postcode in."),
];

export const loginValidator = [
  body("login")
    .notEmpty().withMessage("Gebruikersnaam of e-mailadres is verplicht."),

  body("Password")
    .notEmpty().withMessage("Wachtwoord is verplicht."),
];