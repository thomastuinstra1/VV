import 'dotenv/config';
import express from 'express';
import prisma from './prismaClient.mjs';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.get("/", (req, res) => {
  res.send("Server werkt!");
});

app.get('/Account', async (req, res) => {
  try {
    const accounts = await prisma.account.findMany();
    res.json(accounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server draait op http://${HOST}:${PORT}`);
});