import 'dotenv/config';
import express from 'express';
import prisma from './prismaClient.mjs';

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Shitshow werkt");
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

app.listen(3000, () => {
  console.log('Server draait op http://localhost:3000');
});