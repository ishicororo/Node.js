const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submit-btn');
const toggleMode = document.getElementById('toggle-mode');
const formTitle = document.getElementById('form-title');
const errorMsg = document.getElementById('error-msg');

let isLoginMode = true;

submitBtn.addEventListener('click', async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  if (!username || !password) {
    errorMsg.textContent = 'すべての項目を入力してください。';
    return;
  }

  const endpoint = isLoginMode ? '/api/login' : '/api/register';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.success) {
    location.href = '/chat.html';
  } else {
    errorMsg.textContent = data.error || 'エラーが発生しました';
  }
});

toggleMode.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  submitBtn.textContent = isLoginMode ? 'ログイン' : '登録';
  formTitle.textContent = isLoginMode ? 'ログイン' : '新規登録';
  toggleMode.textContent = isLoginMode ? '新規登録はこちら' : 'ログインはこちら';
  errorMsg.textContent = '';
});