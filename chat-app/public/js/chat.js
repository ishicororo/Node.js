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
  const res = await fetch('/api/me');
  if (!res.ok) {
    location.href = '/';
    return;
  }
  const data = await res.json();
  currentUser = data.username;
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
    message: msg
  });

  input.value = '';
});

// 過去ログ表示
socket.on('chatHistory', (messages) => {
  messages.forEach(renderMessage);
});

// 新着メッセージ表示
socket.on('newMessage', renderMessage);

// 初期化
(async () => {
  await fetchUser();
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

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/';
});
const inviteBtn = document.getElementById('invite-btn');
const inviteInput = document.getElementById('invite-username');

inviteBtn.addEventListener('click', async () => {
  const username = inviteInput.value.trim();
  if (!username || !currentRoom) {
    alert('ユーザー名とルームが必要です');
    return;
  }

  const res = await fetch(`/api/rooms/${currentRoom}/add-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username })
  });

  const result = await res.json();
  if (res.ok) {
    alert(`${username} をルームに追加しました`);
    inviteInput.value = '';
  } else {
    alert(result.error || '追加に失敗しました');
  }
});
function renderMessage({ user: sender, message, timestamp }) {
  const div = document.createElement('div');
   if (sender === 'system') {
    // システムメッセージ（中央表示、灰色）
    div.className = 'system-message';
    div.innerHTML = `<em>🔔 ${message}</em>`;
  } if (sender === 'system') {
    // システムメッセージ（中央表示、灰色）
    div.className = 'system-message';
    div.innerHTML = `<em>🔔 ${message}</em>`;
  }
  else{
  const isMe = sender === currentUser;

  div.classList.add('message');
  div.classList.add(isMe ? 'me' : 'other');

  const time=new Date(timestamp).toLocaleTimeString('ja-JP',{hour: '2-digit', minute: '2-digit' });

  div.className = 'message ' + (isMe ? 'me' : 'other');
  div.innerHTML = `
    <div>${message}</div>
    <span class="timestamp">${timestamp}</span>
  `;
}
  chatArea.appendChild(div);
  div.scrollIntoView();
}