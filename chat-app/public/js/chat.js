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
  const isSystem = sender === 'system';
  const isMe = sender === currentUser;

  const wrapper = document.createElement('div');

  if (isSystem) {
    wrapper.className = 'system-message';
    wrapper.innerHTML = `<em>🔔 ${message}</em>`;
  } else {
    wrapper.classList.add('message-wrapper', isMe ? 'me' : 'other');

    if (!isMe) {
      const nameElem = document.createElement('div');
      nameElem.className = 'username';
      nameElem.textContent = sender;
      wrapper.appendChild(nameElem);
    }

    const msgElem = document.createElement('div');
    msgElem.className = 'message';
    msgElem.textContent = message;
    wrapper.appendChild(msgElem);

    const timeElem = document.createElement('div');
    timeElem.className = 'timestamp';
    timeElem.textContent = new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
    wrapper.appendChild(timeElem);
  }

  chatArea.appendChild(wrapper);
  wrapper.scrollIntoView();
}
// ユーザー名表示とモーダル要素取得
const userNameDisplay = document.getElementById('user-name-display');
const userSettingsModal = document.getElementById('user-settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');


// ログイン後にユーザー名表示をセット
function updateUserNameDisplay(name) {
  currentUser = name;
  userNameDisplay.textContent = name;
}

// ユーザー名表示クリックでモーダル表示
userNameDisplay.addEventListener('click', () => {
  userSettingsModal.style.display = 'flex';
  // もし必要なら初期値セット
  document.getElementById('new-username').value = currentUser;
  document.getElementById('new-password').value = '';
});

// モーダル閉じる
closeSettingsBtn.addEventListener('click', () => {
  userSettingsModal.style.display = 'none';
});

// 設定保存（例：APIに送信）
saveSettingsBtn.addEventListener('click', async () => {
  const newUsername = document.getElementById('new-username').value.trim();
  const newPassword = document.getElementById('new-password').value.trim();

  if (!newUsername) {
    alert('ユーザー名は空にできません');
    return;
  }

  // ここでAPI呼び出し例（実装に合わせて調整ください）
  try {
    const res = await fetch('/api/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newUsername, newPassword }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      alert('ユーザー設定を更新しました');
      updateUserNameDisplay(newUsername);
      userSettingsModal.style.display = 'none';
    } else {
      alert(data.error || '更新に失敗しました');
    }
  } catch (err) {
    alert('通信エラーが発生しました');
  }
});

// アカウント削除（要確認ダイアログ）
deleteAccountBtn.addEventListener('click', async () => {
  if (!confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) return;

  try {
    const res = await fetch('/api/user/delete', {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      alert('アカウントを削除しました。ログアウトします。');
      location.href = '/';
    } else {
      alert('削除に失敗しました');
    }
  } catch (err) {
    alert('通信エラーが発生しました');
  }
});
// ユーザー名を取得して表示
fetch('/api/me')
  .then(res => res.json())
  .then(data => {
    if (data.username) {
      document.getElementById('user-name-display').textContent = data.username;
    }
  })
  .catch(err => {
    console.error('ユーザー名取得失敗:', err);
  });