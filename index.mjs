import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { Server } from "socket.io";
import http from "http";

import authRouter        from './routes/auth.mjs';
import passwordRouter    from './routes/password.mjs';
import accountRouter     from './routes/account.mjs';
import gereedschapRouter from './routes/gereedschap.mjs';
import uitleenRouter     from './routes/uitleen.mjs';
import chatRouter        from './routes/chat.mjs';
import { initSocket }    from './sockets/chatSocket.mjs';

import AppError     from './utils/appError.mjs';
import errorHandler from './middleware/errorhandler.mjs';

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// ── Routes ──
app.use(authRouter);
app.use(passwordRouter);
app.use(accountRouter);
app.use(gereedschapRouter);
app.use(uitleenRouter);
app.use(chatRouter);

// ── 404 – geen route gevonden ──
app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} niet gevonden`, 404));
});

// ── Centrale errorhandler (altijd als laatste!) ──
app.use(errorHandler);

// ── Socket.IO ──
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

initSocket(io);

// ── Server starten ──
server.listen(PORT, HOST, () => {
  console.log(`Server draait op https://${HOST}:${PORT}`);
});
