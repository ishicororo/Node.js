const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const fs = require('fs-extra');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─── ディレクトリ設定 ─────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');

// ─── セッション設定 ─────────────────────
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie:{
    httpOnly:true,
    maxAge:24 * 60 * 1000
  }
}));

// ─── ミドルウェア ─────────────────────
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── ルート: ログインページ ──────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ─── API: ログイン処理 ───────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const users = await fs.readJSON(USERS_FILE).catch(() => []);

  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'ユーザーが存在しません' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'パスワードが間違っています' });

  req.session.user = username;
  res.json({ success: true });
});

// ─── API: ユーザー登録 ───────────────────
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  let users = await fs.readJSON(USERS_FILE).catch(() => []);

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'ユーザー名が既に存在します' });
  }

  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash });

  await fs.writeJSON(USERS_FILE, users, { spaces: 2 });
  res.json({ success: true });
});

// ─── API: ルーム一覧取得 ────────────────
app.get('/api/rooms', async (req, res) => {
  const rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  res.json(rooms);
});

// ─── API: ルーム作成 ─────────────────────
app.post('/api/rooms',requireLogin,async (req, res) => {
  const { roomName } = req.body;
  let rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  if (rooms.find(r => r.name === roomName)) {
    return res.status(400).json({ error: 'ルーム名が既に使われています' });
  }

  const newRoom = { name: roomName, createdBy: req.session.user };
  rooms.push(newRoom);
  await fs.writeJSON(ROOMS_FILE, rooms, { spaces: 2 });
  await fs.ensureFile(path.join(MESSAGES_DIR, `${roomName}.json`));
  res.json({ success: true });
});


// ─── Socket.IO: メッセージ送受信 ─────────
io.on('connection', (socket) => {
  console.log('✅ クライアント接続');

  socket.on('joinRoom', async (room) => {
    socket.join(room);
    const msgFile = path.join(MESSAGES_DIR, `${room}.json`);
    const messages = await fs.readJSON(msgFile).catch(() => []);
    socket.emit('chatHistory', messages);
  });

  socket.on('chatMessage', async ({ room, user, message }) => {
    const timestamp = new Date().toISOString();
    const msgObj = { user, message, timestamp };

    const msgFile = path.join(MESSAGES_DIR, `${room}.json`);
    const messages = await fs.readJSON(msgFile).catch(() => []);
    messages.push(msgObj);
    await fs.writeJSON(msgFile, messages, { spaces: 2 });

    io.to(room).emit('newMessage', msgObj);
  });
});

// ─── サーバー起動 ─────────────────────
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 サーバー起動中: http://localhost:${PORT}`);
});
// チャット画面の認証チェック
app.get('/chat.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public/chat.html'));
});

// APIなどでも使いたい場合に再利用しやすくするなら:
function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'ログインが必要です' });
  next();
}

app.get('/api/me', requireLogin, (req, res) => {
  res.json({ username: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});