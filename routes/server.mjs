import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: "YOUR_MYSQL_SERVER_IP",
  user: "YOUR_MYSQL_USER",
  password: "YOUR_MYSQL_PASSWORD",
  database: "YOUR_DATABASE_NAME",
  waitForConnections: true,
  connectionLimit: 10
});

app.post("/api/create-ticket", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.json({ success: false, message: "Alle velden zijn verplicht" });
    }

    const [result] = await db.execute(
      `INSERT INTO tickets (name, email, subject, message)
       VALUES (?, ?, ?, ?)`,
      [name, email, subject, message]
    );

    // Optional: call Google Apps Script email webhook here later

    res.json({
      success: true,
      ticket_id: result.insertId
    });

  } catch (err) {
    console.error("Ticket error:", err);
    res.json({ success: false, message: "Ticket kon niet worden opgeslagen" });
  }
});

app.listen(3000, () => {
  console.log("Ticket API draait op poort 3000");
});