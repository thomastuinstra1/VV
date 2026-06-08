app.post("/api/create-ticket", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.json({
        success: false,
        message: "Alle velden zijn verplicht"
      });
    }

    const [result] = await db.execute(
      `INSERT INTO tickets (name, email, subject, message)
       VALUES (?, ?, ?, ?)`,
      [name, email, subject, message]
    );

    fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "new_ticket",
        ticketId: result.insertId,
        name,
        email,
        subject,
        message
      })
    }).catch(err => console.error("Ticket mail error:", err));

    res.json({
      success: true,
      ticket_id: result.insertId
    });

  } catch (err) {
    console.error("Ticket error:", err);
    res.json({
      success: false,
      message: "Ticket kon niet worden opgeslagen"
    });
  }
});