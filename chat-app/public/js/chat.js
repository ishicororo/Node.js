const socket = io();
const chatArea = document.getElementById('chat-area');
const input = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const roomSelector = document.getElementById('room-selector');

let currentUser = null;
let currentRoom = null;

// ユーザーを取得（サーバーにセッションが必要）
async function fetchUser() {
  // ログイン時にセッションで保存されている前提
  const res = await fetch('/api/rooms');
  if (!res.ok) location.href = '/';
}

// ルーム一覧取得 & セレクトに追加
async function loadRooms() {
  const res = await fetch('/api/rooms');
  const rooms = await res.json();

  roomSelector.innerHTML = '';
  rooms.forEach(room => {
    const opt = document.createElement('option');
    opt.value = room.name;
    opt.textContent = room.name;
    roomSelector.appendChild(opt);
  });

  if (rooms.length > 0) {
    currentRoom = rooms[0].name;
    roomSelector.value = currentRoom;
    joinRoom(currentRoom);
  }
}

roomSelector.addEventListener('change', () => {
  currentRoom = roomSelector.value;
  joinRoom(currentRoom);
});

function joinRoom(room) {
  socket.emit('joinRoom', room);
  chatArea.innerHTML = '';
}

// メッセージ送信
sendButton.addEventListener('click', () => {
  const msg = input.value.trim();
  if (!msg || !currentRoom) return;

  socket.emit('chatMessage', {
    room: currentRoom,
    user: currentUser || 'あなた',
    message: msg
  });

  input.value = '';
});

// 過去ログ表示
socket.on('chatHistory', (messages) => {
  messages.forEach(showMessage);
});

// 新着メッセージ表示
socket.on('newMessage', showMessage);

function showMessage({ user, message, timestamp }) {
  const div = document.createElement('div');
  const time = new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  div.classList.add('message');
  div.classList.add(user === currentUser ? 'me' : 'other');
  div.innerHTML = `
    ${message}
    <div class="timestamp">${time}</div>
  `;

  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 初期化
(async () => {
  await fetchUser();
  currentUser = 'あなた'; // ※将来的にユーザー名をセッションから取得
  await loadRooms();
})();

document.getElementById('create-room-btn').addEventListener('click', async () => {
  const newRoom = prompt('新しいルーム名を入力してください');
  if (!newRoom) return;

  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName: newRoom })
  });

  const data = await res.json();
  if (data.success) {
    alert('ルームが作成されました');
    await loadRooms();
    roomSelector.value = newRoom;
    joinRoom(newRoom);
  } else {
    alert(data.error || 'ルーム作成に失敗しました');
  }
});