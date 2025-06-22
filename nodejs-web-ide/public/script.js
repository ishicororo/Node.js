const codeEditor = document.getElementById('codeEditor');
const runCodeBtn = document.getElementById('runCodeBtn');
const outputArea = document.getElementById('outputArea');
const fileListElement = document.getElementById('fileList');
const createFileBtn = document.getElementById('createFileBtn');
const createDirBtn = document.getElementById('createDirBtn');
const uploadFileBtn = document.getElementById('uploadFileBtn');
const fileUploader = document.getElementById('fileUploader');
const saveFileBtn = document.getElementById('saveFileBtn');
const currentEditingFileSpan = document.getElementById('currentEditingFile');

let ws;
let currentEditingFilePath = null; // 現在エディタで開いているファイルのパス

// WebSocket接続の初期化
function connectWebSocket() {
    // サーバーのポートに合わせる
    // 環境によっては 'ws://' の代わりに 'wss://' (Secure WebSocket) を使用
    ws = new WebSocket('wss://' + window.location.hostname + ':3000');

    ws.onopen = () => {
        console.log('WebSocket connected');
    };

    ws.onmessage = event => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'output':
                outputArea.textContent += data.content + '\n';
                outputArea.scrollTop = outputArea.scrollHeight; // スクロールを一番下へ
                break;
            case 'consoleLog': // Node.js実行中のリアルタイムログ
                outputArea.textContent += data.content;
                outputArea.scrollTop = outputArea.scrollHeight;
                break;
            case 'fileList':
                renderFileList(data.files);
                break;
            case 'fileContent':
                codeEditor.value = data.content;
                currentEditingFilePath = data.filePath;
                currentEditingFileSpan.textContent = `編集中のファイル: ${data.filePath}`;
                saveFileBtn.disabled = false;
                break;
            case 'fileSaved':
                // 保存成功時のフィードバック (アラートはユーザー体験を妨げるため、ここではコンソールログとボタン無効化のみ)
                console.log(`ファイル '${data.filePath}' が保存されました。`);
                saveFileBtn.disabled = true; // 保存後は再度変更があるまで無効にする
                break;
            case 'fileCreated':
                alert(`ファイル '${data.filePath}' が作成されました。`);
                break;
            case 'directoryCreated':
                alert(`ディレクトリ '${data.dirPath}' が作成されました。`);
                break;
            case 'itemDeleted':
                alert(`'${data.itemPath}' が削除されました。`);
                // 削除されたファイルがエディタで開かれていた場合、エディタをクリア
                if (currentEditingFilePath === data.itemPath) {
                    codeEditor.value = '';
                    currentEditingFilePath = null;
                    currentEditingFileSpan.textContent = '';
                    saveFileBtn.disabled = true;
                }
                break;
            case 'itemRenamed':
                alert(`'${data.oldPath}' が '${data.newPath}' にリネームされました。`);
                // リネームされたファイルがエディタで開かれていた場合、パスを更新
                if (currentEditingFilePath === data.oldPath) {
                    currentEditingFilePath = data.newPath;
                    currentEditingFileSpan.textContent = `編集中のファイル: ${data.newPath}`;
                }
                break;
            case 'error':
                outputArea.textContent += `Error: ${data.message}\n`;
                console.error('Server error:', data.message);
                break;
            default:
                console.log('Unknown message type:', data);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected. Reconnecting in 5 seconds...');
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = error => {
        console.error('WebSocket error:', error);
        outputArea.textContent += `WebSocket Connection Error: ${error.message || 'Unknown error'}\n`;
    };
}

// 初期接続
connectWebSocket();

// コード実行ボタン
runCodeBtn.addEventListener('click', () => {
    const code = codeEditor.value;
    outputArea.textContent = ''; // 出力エリアをクリア
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'executeCode', code: code }));
    } else {
        alert('WebSocket is not connected. Please refresh the page.');
    }
});

// ファイル保存ボタン
saveFileBtn.addEventListener('click', () => {
    if (currentEditingFilePath) {
        const content = codeEditor.value;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'saveFile', filePath: currentEditingFilePath, content: content }));
            saveFileBtn.disabled = true; // 保存中は無効にする (サーバーからの成功通知で再度有効化)
        }
    } else {
        alert('保存するファイルが選択されていません。');
    }
});

// エディタの内容が変更されたら保存ボタンを有効化
codeEditor.addEventListener('input', () => {
    if (currentEditingFilePath) {
        saveFileBtn.disabled = false;
    }
});

// ファイルエクスプローラーのレンダリング
function renderFileList(files) {
    fileListElement.innerHTML = ''; // クリア
    files.forEach(item => {
        fileListElement.appendChild(createFileListItem(item));
    });
}

// ファイル/ディレクトリのリストアイテムを作成
function createFileListItem(item) {
    const li = document.createElement('li');
    li.dataset.path = item.path; // フルパスをデータ属性に保存
    li.dataset.type = item.type; // タイプもデータ属性に保存

    const span = document.createElement('span');
    span.classList.add('item-name', item.type === 'directory' ? 'folder' : 'file');
    span.textContent = item.name;
    li.appendChild(span);

    // クリックでファイルの内容を読み込む
    if (item.type === 'file') {
        span.addEventListener('click', () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'readFile', filePath: item.path }));
            }
            // 選択されたファイルにクラスを追加
            document.querySelectorAll('#fileList li').forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
        });
    } else if (item.type === 'directory') {
        // ディレクトリの場合はクリックで展開・折りたたみ
        span.addEventListener('click', (e) => {
            e.stopPropagation(); // 親要素へのイベント伝播を防ぐ
            const ul = li.querySelector('ul');
            if (ul) {
                ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
            }
        });
        // サブディレクトリがある場合は再帰的にレンダリング
        if (item.children && item.children.length > 0) {
            const ul = document.createElement('ul');
            ul.classList.add('file-tree');
            // デフォルトで展開するかどうかはここで調整 ('block' or 'none')
            ul.style.display = 'block';
            item.children.forEach(child => {
                ul.appendChild(createFileListItem(child));
            });
            li.appendChild(ul);
        }
    }

    // 右クリックメニューの追加
    span.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // デフォルトの右クリックメニューを抑制
        // クリックされたアイテムを選択状態にする
        document.querySelectorAll('#fileList li').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        showContextMenu(e, item);
    });

    return li;
}

// 右クリックメニューの表示
function showContextMenu(e, item) {
    // 既存のメニューを削除
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('ul');
    menu.classList.add('context-menu');

    const renameItem = document.createElement('li');
    renameItem.textContent = '名前を変更';
    renameItem.addEventListener('click', () => {
        const newName = prompt(`新しい名前を入力してください (${item.name}):`);
        if (newName && newName.trim() !== '') {
            // パスからファイル名/ディレクトリ名部分を抽出して置き換え
            const parentPath = item.path.includes('/') ? item.path.substring(0, item.path.lastIndexOf('/')) : '';
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;

            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'renameItem', oldPath: item.path, newPath: newPath }));
            }
        }
        menu.remove();
    });
    menu.appendChild(renameItem);

    const deleteItem = document.createElement('li');
    deleteItem.textContent = '削除';
    deleteItem.addEventListener('click', () => {
        if (confirm(`本当に '${item.name}' を削除しますか？`)) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'deleteItem', itemPath: item.path }));
            }
        }
        menu.remove();
    });
    menu.appendChild(deleteItem);

    // メニューの位置を設定
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    document.body.appendChild(menu);

    // メニュー外をクリックしたらメニューを閉じる
    const clickOutside = (event) => {
        if (!menu.contains(event.target)) {
            menu.remove();
            document.removeEventListener('click', clickOutside);
        }
    };
    document.addEventListener('click', clickOutside);
}

// ファイル作成ボタン
createFileBtn.addEventListener('click', () => {
    const fileName = prompt('作成するファイル名を入力してください:');
    if (fileName && fileName.trim() !== '') {
        // 現在選択中のディレクトリがあればその中に、なければルートに作成
        const selectedLi = document.querySelector('.file-tree li.selected');
        let parentPath = '';
        if (selectedLi && selectedLi.dataset.type === 'directory') {
            parentPath = selectedLi.dataset.path;
        } else if (selectedLi && selectedLi.dataset.type === 'file') {
            // ファイルが選択されている場合は、そのファイルの親ディレクトリ
            parentPath = selectedLi.dataset.path.includes('/') ? selectedLi.dataset.path.substring(0, selectedLi.dataset.path.lastIndexOf('/')) : '';
        }
        
        const fullPath = parentPath ? `${parentPath}/${fileName}` : fileName;

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'createFile', filePath: fullPath }));
        }
    }
});

// ディレクトリ作成ボタン
createDirBtn.addEventListener('click', () => {
    const dirName = prompt('作成するディレクトリ名を入力してください:');
    if (dirName && dirName.trim() !== '') {
        const selectedLi = document.querySelector('.file-tree li.selected');
        let parentPath = '';
        if (selectedLi && selectedLi.dataset.type === 'directory') {
            parentPath = selectedLi.dataset.path;
        } else if (selectedLi && selectedLi.dataset.type === 'file') {
            parentPath = selectedLi.dataset.path.includes('/') ? selectedLi.dataset.path.substring(0, selectedLi.dataset.path.lastIndexOf('/')) : '';
        }

        const fullPath = parentPath ? `${parentPath}/${dirName}` : dirName;

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'createDirectory', dirPath: fullPath }));
        }
    }
});

// ファイルアップロードボタン
uploadFileBtn.addEventListener('click', () => {
    fileUploader.click(); // 非表示のinput要素をクリック
});

fileUploader.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('uploadedFile', file);

        try {
            // 現在選択中のディレクトリがあればその中にアップロード
            const selectedLi = document.querySelector('.file-tree li.selected');
            let uploadPath = '';
            if (selectedLi && selectedLi.dataset.type === 'directory') {
                uploadPath = selectedLi.dataset.path;
            } else if (selectedLi && selectedLi.dataset.type === 'file') {
                uploadPath = selectedLi.dataset.path.includes('/') ? selectedLi.dataset.path.substring(0, selectedLi.dataset.path.lastIndexOf('/')) : '';
            }
            // FormData にアップロードパスを追加
            formData.append('uploadPath', uploadPath);


            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                alert('ファイルがアップロードされました。');
                // バックエンドからファイルリスト更新が通知されるはず
            } else {
                alert('ファイルのアップロードに失敗しました。');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('ファイルのアップロード中にエラーが発生しました。');
        } finally {
            event.target.value = ''; // 同じファイルを再度アップロードできるようにinputをクリア
        }
    }
});