import { Router } from 'express';

import prisma from '../prismaClient.mjs';
import asyncHandler from '../middleware/asyncHandler.mjs';
import AppError from '../utils/appError.mjs';

const router = Router();

router.post(
  '/',
  asyncHandler(async (req, res, next) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return next(new AppError('Alle velden zijn verplicht', 400));
    }

    const ticket = await prisma.tickets.create({
      data: {
        name,
        email,
        subject,
        message
      }
    });

    console.log("APPS_SCRIPT_URL:", process.env.APPS_SCRIPT_URL);

    try {
      const mailRes = await fetch(process.env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_ticket',
          ticketId: ticket.id,
          name,
          email,
          subject,
          message
        })
      });

      const mailText = await mailRes.text();
      console.log("Ticket mail response:", mailText);

    } catch (err) {
      console.error("Ticket mail error:", err);
    }

    res.status(201).json({
      success: true,
      ticket_id: ticket.id
    });
  })
);

export default router;