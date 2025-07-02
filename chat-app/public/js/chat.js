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
    let roomMap = {}; // ← ルーム情報を保存する辞書（管理者チェック用）

async function loadRooms() {
  const res = await fetch('/api/rooms');
  const rooms = await res.json();

  roomMap = {}; // 初期化

  roomSelector.innerHTML = '';
  rooms.forEach(room => {
    roomMap[room.name] = room; // ← 各ルームの情報を記録
    const opt = document.createElement('option');
    opt.value = room.name;
    opt.textContent = room.name;
    roomSelector.appendChild(opt);
  });

  if (rooms.length > 0) {
    currentRoom = rooms[0].name;
    roomSelector.value = currentRoom;
    joinRoom(currentRoom);
    updateRoomControls(); // ← 管理者UIの表示/非表示を更新
  }
}
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

  try {
    const res = await fetch('/api/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newUsername, newPassword }),
      credentials: 'include',
    });

    const text = await res.text();
    console.log('🧾 レスポンステキスト:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('❌ JSON解析エラー:', e, text);
      alert('サーバーから不正なレスポンス');
      return;
    }

    if (res.ok) {
      alert('ユーザー設定を更新しました');
      updateUserNameDisplay(newUsername);
      userSettingsModal.style.display = 'none';
    } else {
      alert(data.error || '更新に失敗しました');
    }
  } catch (err) {
    console.error('❌ 通信エラー:', err);
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
// ログインユーザー名を表示
document.addEventListener('DOMContentLoaded', () => {
  const userDisplay = document.getElementById('user-name-display');
  userDisplay.textContent = 'ログイン中…'; // 初期表示

  fetch('/api/me', { credentials: 'include' })
    .then(res => {
      if (!res.ok) throw new Error('HTTPエラー');
      return res.json();
    })
    .then(data => {
      if (data.username) {
        userDisplay.textContent = data.username;
      } else {
        userDisplay.textContent = '未ログイン';
      }
    })
    .catch(err => {
      console.error('ユーザー名取得失敗:', err);
      userDisplay.textContent = '通信エラー';
    });
});
const roomControls = document.getElementById('room-controls');
const deleteRoomBtn = document.getElementById('delete-room-btn');

// 管理者だけ操作ボタンを表示
function updateRoomControls() {
  if (!currentRoom || !roomMap[currentRoom]) return;

  const room = roomMap[currentRoom];
  const isAdmin = room.admins && room.admins.includes(currentUser);

  roomControls.style.display = isAdmin ? 'block' : 'none';
}

// ルーム切り替え時にも表示制御
roomSelector.addEventListener('change', () => {
  currentRoom = roomSelector.value;
  joinRoom(currentRoom);
  updateRoomControls(); // ← 追加
});

// 削除ボタンの処理
deleteRoomBtn.addEventListener('click', async () => {
  if (!currentRoom) return;
  const confirmed = confirm(`${currentRoom} を本当に削除しますか？`);
  if (!confirmed) return;

  const res = await fetch(`/api/rooms/${currentRoom}/delete`, {
    method: 'POST',
    credentials: 'include',
  });

  if (res.ok) {
    alert('ルームを削除しました');
    await loadRooms(); // ルームリスト更新
  } else {
    const err = await res.json();
    alert(err.error || '削除に失敗しました');
  }
});
const groupSettingsModal = document.getElementById('group-settings-modal');
const openGroupSettingsBtn = document.getElementById('open-group-settings-btn');
const closeGroupSettingsBtn = document.getElementById('close-group-settings');
const memberList = document.getElementById('member-list');
const adminActions = document.getElementById('admin-actions');
const leaveRoomBtn = document.getElementById('leave-room-btn');

// 表示
openGroupSettingsBtn.addEventListener('click', () => {
  updateGroupSettings();
  groupSettingsModal.style.display = 'flex';
});

// 閉じる
closeGroupSettingsBtn.addEventListener('click', () => {
  groupSettingsModal.style.display = 'none';
});

// モーダル内容更新
function updateGroupSettings() {
  if (!currentRoom || !roomMap[currentRoom]) return;
  const room = roomMap[currentRoom];
  const isAdmin = room.admins?.includes(currentUser);
  const members = room.users || [];

  memberList.innerHTML = '';
  members.forEach(member => {
    const li = document.createElement('li');
    li.textContent = `${member}${room.admins?.includes(member) ? ' 👑' : ''}`;
    memberList.appendChild(li);
  });

  adminActions.style.display = isAdmin ? 'block' : 'none';
}

// 離脱ボタン処理
leaveRoomBtn.addEventListener('click', async () => {
  if (!confirm('このルームから退出しますか？')) return;

  const res = await fetch(`/api/rooms/${currentRoom}/leave`, {
    method: 'POST',
    credentials: 'include'
  });

  if (res.ok) {
    alert('ルームから退出しました');
    groupSettingsModal.style.display = 'none';
    await loadRooms();
  } else {
    alert('退出に失敗しました');
  }
});