import { body } from "express-validator";

export const gereedschapValidator = [
  body("naam")
    .notEmpty().withMessage("Naam van het gereedschap is verplicht.")
    .isLength({ max: 150 }).withMessage("Naam mag maximaal 150 tekens zijn."),

  body("beschrijving")
    .optional()
    .isLength({ max: 1000 }).withMessage("Beschrijving mag maximaal 1000 tekens zijn."),

  body("categorie")
    .notEmpty().withMessage("Categorie is verplicht."),

  body("status")
    .optional()
    .isIn(["beschikbaar", "uitgeleend", "in_onderhoud"])
    .withMessage("Status moet 'beschikbaar', 'uitgeleend' of 'in_onderhoud' zijn."),
];