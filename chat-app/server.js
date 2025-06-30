const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const fs = require('fs-extra');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');
const sharedSession = require('express-socket.io-session');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

//─── セッションミドルウェア設定 ─────────────────────
const sessionMiddleware = session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
});

app.use(sessionMiddleware);

// ←ここでセッションをSocket.IOにも共有
io.use(sharedSession(sessionMiddleware, {
  autoSave: true
}));

// ─── ディレクトリ設定 ─────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');

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
app.get('/api/rooms',requireLogin, async (req, res) => {
  const user=req.session.user;
  const rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  const userRooms = rooms.filter(room => {
    if(!room.users) return room.createdBy === user;
    return room.users.includes(user);
  });
  console.log('ユーザー参加ルーム：',userRooms)
  res.json(userRooms);
});

// ─── API: ルーム作成 ─────────────────────
app.post('/api/rooms',requireLogin,async (req, res) => {
  const { roomName } = req.body;
  let rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  if (rooms.find(r => r.name === roomName)) {
    return res.status(400).json({ error: 'ルーム名が既に使われています' });
  }

  const newRoom = { name: roomName, createdBy: req.session.user ,users:[req.session.user]};
  rooms.push(newRoom);
  await fs.writeJSON(ROOMS_FILE, rooms, { spaces: 2 });
  await fs.ensureFile(path.join(MESSAGES_DIR, `${roomName}.json`));
  res.json({ success: true });
});


// ─── Socket.IO: メッセージ送受信 ─────────
io.on('connection', (socket) => {
  console.log('✅ クライアント接続');

  // セッション取得用のラッパー（express-sessionが socket.request.session にある前提）
  const req = socket.request;
  const user = socket.handshake.session.user;
  console.log("🧑 接続ユーザー:", user);

  if (!user) {
    socket.disconnect(true);
    return;
  }

  socket.on('joinRoom', async (roomName) => {
    const rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
    const room = rooms.find(r => r.name === roomName);
    if (!room) return;

    if(!room.users) room.users = [room.createdBy];

    if (!room.users.includes(user)) {
      room.users.push(user);
      await fs.writeJSON(ROOMS_FILE, rooms, {spaces: 2 });
    }

    socket.join(roomName);

    const msgFile = path.join(MESSAGES_DIR, `${roomName}.json`);
    const messages = await fs.readJSON(msgFile).catch(() => []);
    socket.emit('chatHistory', messages);
    io.to(roomName).emit('newMessage', {
    user: 'system',
    message: `${user} が参加しました`,
    timestamp: new Date().toLocaleString()
  });
  });

  socket.on('chatMessage', async ({ room, message }) => {
    const timestamp = new Date().toLocaleString(); // 表示用に整える

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

// ユーザーをルームに追加
app.post('/api/rooms/:roomName/add-user', requireLogin, async (req, res) => {
  const { roomName } = req.params;
  const { username } = req.body;

  const users = await fs.readJSON(USERS_FILE).catch(() => []);
  const rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);

  const room = rooms.find(r => r.name === roomName);
  if (!room) return res.status(404).json({ error: 'ルームが存在しません' });

  // 招待できるのは作成者だけに制限する場合：
  if (room.createdBy !== req.session.user) {
    return res.status(403).json({ error: 'この操作は許可されていません' });
  }

  // ユーザーが存在するか？
  const userExists = users.some(u => u.username === username);
  if (!userExists) return res.status(400).json({ error: 'ユーザーが存在しません' });

  // 初回なら users フィールドを作る
  if (!room.users) room.users = [room.createdBy];

  if (!room.users.includes(username)) {
    room.users.push(username);
  } else {
    return res.status(400).json({ error: '既に追加されています' });
  }

  await fs.writeJSON(ROOMS_FILE, rooms, { spaces: 2 });
  res.json({ success: true });
});
const multer = require('multer');
const UPLOAD_DIR = path.join(__dirname, 'public/uploads');
fs.ensureDirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

app.post('/upload', requireLogin, upload.single('file'), (req, res) => {
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});