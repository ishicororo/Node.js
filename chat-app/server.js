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
    secure: true,
    maxAge: 24 * 60 * 60 * 1000,
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

  const newRoom = {
     name: roomName,
     createdBy: req.session.user ,
     users:[req.session.user],
     admins: [req.session.user],
    };
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

  if (!room.users.includes(req.session.user)) {
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
app.post('/api/user/update', requireLogin, async (req, res) => {
  console.log('現在ログイン中:', req.session.user);
  const { newUsername, newPassword } = req.body;
  const currentUsername = req.session.user;

  let users = await fs.readJSON(USERS_FILE).catch(() => []);
  const userIndex = users.findIndex(u => u.username === currentUsername);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'ユーザーが見つかりません' });
  }

  if (newUsername !== currentUsername && users.some(u => u.username === newUsername)) {
    return res.status(400).json({ error: 'そのユーザー名は既に使われています' });
  }

  users[userIndex].username = newUsername;

  if (newPassword) {
    const hash = await bcrypt.hash(newPassword, 10);
    users[userIndex].password = hash;
  }

  await fs.writeJSON(USERS_FILE, users, { spaces: 2 });

  // ルーム関連のユーザー名更新
  let rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  for (const room of rooms) {
    if (room.createdBy === currentUsername) {
      room.createdBy = newUsername;
    }
    if (room.users) {
      const i = room.users.indexOf(currentUsername);
      if (i !== -1) room.users[i] = newUsername;
    }
  }
  await fs.writeJSON(ROOMS_FILE, rooms, { spaces: 2 });

  // メッセージ履歴も更新
  const files = await fs.readdir(MESSAGES_DIR);
  for (const file of files) {
    const filePath = path.join(MESSAGES_DIR, file);
    let messages = await fs.readJSON(filePath).catch(() => []);
    let updated = false;
    for (let msg of messages) {
      if (msg.user === currentUsername) {
        msg.user = newUsername;
        updated = true;
      }
    }
    if (updated) {
      await fs.writeJSON(filePath, messages, { spaces: 2 });
    }
  }

  // セッション更新と保存
  req.session.user = newUsername;
  req.session.save(err => {
    if (err) {
      console.error('セッション保存エラー:', err);
      return res.status(500).json({ error: 'セッション保存に失敗しました' });
    }
    res.json({ success: true });
  });
});
app.post('/api/user/delete', requireLogin, async (req, res) => {
  const username = req.session.user;
  console.log('🗑️ アカウント削除リクエスト:', username);

  let users = await fs.readJSON(USERS_FILE).catch(() => []);
  users = users.filter(u => u.username !== username);
  await fs.writeJSON(USERS_FILE, users, { spaces: 2 });

  let rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  rooms = rooms.filter(room => room.createdBy !== username);
  for (const room of rooms) {
    if (room.users) {
      room.users = room.users.filter(u => u !== username);
    }
  }
  await fs.writeJSON(ROOMS_FILE, rooms, { spaces: 2 });

  // セッション破棄 + Cookieクリア
  req.session.destroy(err => {
    if (err) {
      console.error('セッション破棄失敗:', err);
      return res.status(500).json({ error: 'ログアウトに失敗しました' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});
function isAdmin(user, room) {
  return room.admins && room.admins.includes(user);
}
app.post('/api/rooms/:roomName/delete', requireLogin, async (req, res) => {
  const { roomName } = req.params;
  const rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  const room = rooms.find(r => r.name === roomName);

  if (!room) return res.status(404).json({ error: 'ルームが見つかりません' });

  if (!isAdmin(req.session.user, room)) {
    return res.status(403).json({ error: '管理者権限がありません' });
  }

  const updatedRooms = rooms.filter(r => r.name !== roomName);
  await fs.writeJSON(ROOMS_FILE, updatedRooms, { spaces: 2 });

  const msgFile = path.join(MESSAGES_DIR, `${roomName}.json`);
  await fs.remove(msgFile).catch(() => {});

  res.json({ success: true });
});
app.post('/api/rooms/:roomName/add-admin', requireLogin, async (req, res) => {
  const { roomName } = req.params;
  const { username } = req.body;

  const rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  const room = rooms.find(r => r.name === roomName);
  if (!room) return res.status(404).json({ error: 'ルームが見つかりません' });

  if (!isAdmin(req.session.user, room)) {
    return res.status(403).json({ error: '管理者しか追加できません' });
  }

  if (!room.users.includes(username)) {
    return res.status(400).json({ error: 'そのユーザーはこのルームにいません' });
  }

  if (!room.admins.includes(username)) {
    room.admins.push(username);
    await fs.writeJSON(ROOMS_FILE, rooms, { spaces: 2 });
    return res.json({ success: true });
  } else {
    return res.status(400).json({ error: 'すでに管理者です' });
  }
});
app.post('/api/rooms/:roomName/leave', requireLogin, async (req, res) => {
  const { roomName } = req.params;
  const username = req.session.user;

  let rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  const room = rooms.find(r => r.name === roomName);
  if (!room) return res.status(404).json({ error: 'ルームが存在しません' });

  // 管理者が唯一なら離脱させない
  if (room.admins?.length === 1 && room.admins[0] === username) {
    return res.status(400).json({ error: '唯一の管理者は離脱できません' });
  }

  room.users = room.users.filter(u => u !== username);
  room.admins = room.admins.filter(u => u !== username);
  await fs.writeJSON(ROOMS_FILE, rooms, { spaces: 2 });

  res.json({ success: true });
});
// API: 管理者を追加または削除
app.post('/api/rooms/:roomName/admins', requireLogin, async (req, res) => {
  const { roomName } = req.params;
  const { targetUser, action } = req.body; // action: 'add' or 'remove'

  const rooms = await fs.readJSON(ROOMS_FILE).catch(() => []);
  const room = rooms.find(r => r.name === roomName);
  if (!room) return res.status(404).json({ error: 'ルームが存在しません' });

  if (!room.admins) room.admins = [room.createdBy];
  const isAdmin = room.admins.includes(req.session.user);
  if (!isAdmin) return res.status(403).json({ error: '管理者権限がありません' });

  if (action === 'add') {
    if (!room.users.includes(targetUser)) return res.status(400).json({ error: 'そのユーザーはルームに参加していません' });
    if (!room.admins.includes(targetUser)) room.admins.push(targetUser);
  } else if (action === 'remove') {
    room.admins = room.admins.filter(u => u !== targetUser);
    if (room.admins.length === 0) room.admins.push(room.createdBy); // 少なくとも1人
  } else {
    return res.status(400).json({ error: '不正な操作です' });
  }

  await fs.writeJSON(ROOMS_FILE, rooms, { spaces: 2 });
  res.json({ success: true });
});