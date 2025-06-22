const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ユーザーの作業ディレクトリ (サーバーの起動場所からの相対パス)
const USER_CODE_DIR = path.join(__dirname, 'user_workspace');
if (!fs.existsSync(USER_CODE_DIR)) {
    fs.mkdirSync(USER_CODE_DIR);
}

// 静的ファイルの提供 (フロントエンドのHTML, JS, CSS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // JSON形式のリクエストボディをパース

// Multerの設定 (ファイルアップロード)
const upload = multer({ dest: USER_CODE_DIR });

// WebSocket接続の管理
wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', async message => {
        const data = JSON.parse(message);
        console.log('Received:', data.type);

        switch (data.type) {
            case 'executeCode':
                executeNodeCode(data.code, ws);
                break;
            case 'getFileList':
                sendFileList(ws);
                break;
            case 'readFile':
                readFileContent(data.filePath, ws);
                break;
            case 'createFile':
                createFile(data.filePath, ws);
                break;
            case 'createDirectory':
                createDirectory(data.dirPath, ws);
                break;
            case 'deleteItem':
                deleteItem(data.itemPath, ws);
                break;
            case 'renameItem':
                renameItem(data.oldPath, data.newPath, ws);
                break;
            case 'saveFile':
                saveFileContent(data.filePath, data.content, ws);
                break;
            default:
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });

    // 接続時に一度ファイルリストを送信
    sendFileList(ws);
});

// HTTP POST エンドポイント for ファイルアップロード
app.post('/upload', upload.single('uploadedFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    console.log('File uploaded:', req.file.originalname);
    // ファイルアップロード後、全クライアントにファイルリストを更新するよう通知
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            sendFileList(client);
        }
    });
    res.status(200).send('File uploaded successfully.');
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open your browser at http://localhost:${PORT}`);
});

// --- Node.js コード実行関数 ---
function executeNodeCode(code, ws) {
    // セキュリティのため、ユーザーごとに独立した実行環境を用意するか、
    // Dockerコンテナなどで隔離することを強く推奨します。
    // ここでは簡易的に一時ファイルに保存して実行します。
    const tempFileName = path.join(USER_CODE_DIR, `temp_code_${Date.now()}.js`);
    fs.writeFileSync(tempFileName, code);

    // Node.jsプロセスを子プロセスとして実行
    const childProcess = exec(`node ${tempFileName}`, { cwd: USER_CODE_DIR }, (error, stdout, stderr) => {
        // 一時ファイルを削除
        try {
            fs.unlinkSync(tempFileName);
        } catch (unlinkErr) {
            console.error('Failed to delete temp file:', unlinkErr);
        }

        if (error) {
            ws.send(JSON.stringify({ type: 'output', content: `Error:\n${stderr || error.message}`, error: true }));
            return;
        }
        ws.send(JSON.stringify({ type: 'output', content: `Output:\n${stdout}${stderr}` }));
    });

    // 実行中のプロセスからの出力をリアルタイムでフロントエンドに送る
    childProcess.stdout.on('data', data => {
        ws.send(JSON.stringify({ type: 'consoleLog', content: data.toString() }));
    });
    childProcess.stderr.on('data', data => {
        ws.send(JSON.stringify({ type: 'consoleLog', content: data.toString(), error: true }));
    });
}

// --- ファイル操作関数 ---

async function sendFileList(ws) {
    try {
        const files = await getDirListing(USER_CODE_DIR);
        ws.send(JSON.stringify({ type: 'fileList', files: files }));
    } catch (err) {
        console.error('Error reading directory:', err);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to get file list.' }));
    }
}

// ディレクトリの内容を再帰的に取得
async function getDirListing(dirPath) {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const fileList = await Promise.all(items.map(async item => {
        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(USER_CODE_DIR, fullPath);
        if (item.isDirectory()) {
            return {
                name: item.name,
                path: relativePath,
                type: 'directory',
                children: await getDirListing(fullPath)
            };
        } else {
            return {
                name: item.name,
                path: relativePath,
                type: 'file',
            };
        }
    }));
    // ファイルとディレクトリを名前でソート (ディレクトリが先に来るように)
    fileList.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });
    return fileList;
}

async function readFileContent(filePath, ws) {
    const fullPath = path.join(USER_CODE_DIR, filePath);
    // パストラバーサル攻撃対策: USER_CODE_DIRの外に出ないことを確認
    if (!fullPath.startsWith(USER_CODE_DIR)) {
        ws.send(JSON.stringify({ type: 'error', message: `Access denied: ${filePath}` }));
        return;
    }
    try {
        const content = await fs.promises.readFile(fullPath, 'utf8');
        ws.send(JSON.stringify({ type: 'fileContent', filePath: filePath, content: content }));
    } catch (err) {
        console.error('Error reading file:', err);
        ws.send(JSON.stringify({ type: 'error', message: `Failed to read file: ${filePath}` }));
    }
}

async function saveFileContent(filePath, content, ws) {
    const fullPath = path.join(USER_CODE_DIR, filePath);
    if (!fullPath.startsWith(USER_CODE_DIR)) {
        ws.send(JSON.stringify({ type: 'error', message: `Access denied: ${filePath}` }));
        return;
    }
    try {
        await fs.promises.writeFile(fullPath, content, 'utf8');
        ws.send(JSON.stringify({ type: 'fileSaved', filePath: filePath }));
    } catch (err) {
        console.error('Error saving file:', err);
        ws.send(JSON.stringify({ type: 'error', message: `Failed to save file: ${filePath}` }));
    }
}

async function createFile(filePath, ws) {
    const fullPath = path.join(USER_CODE_DIR, filePath);
    if (!fullPath.startsWith(USER_CODE_DIR)) {
        ws.send(JSON.stringify({ type: 'error', message: `Access denied: ${filePath}` }));
        return;
    }
    try {
        await fs.promises.writeFile(fullPath, '', 'utf8'); // 空のファイルを作成
        ws.send(JSON.stringify({ type: 'fileCreated', filePath: filePath }));
        sendFileList(ws); // ファイルリストを更新
    } catch (err) {
        console.error('Error creating file:', err);
        ws.send(JSON.stringify({ type: 'error', message: `Failed to create file: ${filePath}` }));
    }
}

async function createDirectory(dirPath, ws) {
    const fullPath = path.join(USER_CODE_DIR, dirPath);
    if (!fullPath.startsWith(USER_CODE_DIR)) {
        ws.send(JSON.stringify({ type: 'error', message: `Access denied: ${dirPath}` }));
        return;
    }
    try {
        await fs.promises.mkdir(fullPath, { recursive: true }); // 親ディレクトリもまとめて作成
        ws.send(JSON.stringify({ type: 'directoryCreated', dirPath: dirPath }));
        sendFileList(ws); // ファイルリストを更新
    } catch (err) {
        console.error('Error creating directory:', err);
        ws.send(JSON.stringify({ type: 'error', message: `Failed to create directory: ${dirPath}` }));
    }
}

async function deleteItem(itemPath, ws) {
    const fullPath = path.join(USER_CODE_DIR, itemPath);
    if (!fullPath.startsWith(USER_CODE_DIR)) {
        ws.send(JSON.stringify({ type: 'error', message: `Access denied: ${itemPath}` }));
        return;
    }
    try {
        const stats = await fs.promises.stat(fullPath);
        if (stats.isDirectory()) {
            await fs.promises.rm(fullPath, { recursive: true, force: true }); // ディレクトリを再帰的に削除
        } else {
            await fs.promises.unlink(fullPath); // ファイルを削除
        }
        ws.send(JSON.stringify({ type: 'itemDeleted', itemPath: itemPath }));
        sendFileList(ws); // ファイルリストを更新
    } catch (err) {
        console.error('Error deleting item:', err);
        ws.send(JSON.stringify({ type: 'error', message: `Failed to delete item: ${itemPath}` }));
    }
}

async function renameItem(oldPath, newPath, ws) {
    const fullOldPath = path.join(USER_CODE_DIR, oldPath);
    const fullNewPath = path.join(USER_CODE_DIR, newPath);

    // 両方のパスがUSER_CODE_DIR内に収まっていることを確認
    if (!fullOldPath.startsWith(USER_CODE_DIR) || !fullNewPath.startsWith(USER_CODE_DIR)) {
        ws.send(JSON.stringify({ type: 'error', message: `Access denied: Rename operation on ${oldPath} to ${newPath}` }));
        return;
    }

    try {
        await fs.promises.rename(fullOldPath, fullNewPath);
        ws.send(JSON.stringify({ type: 'itemRenamed', oldPath, newPath }));
        sendFileList(ws); // ファイルリストを更新
    } catch (err) {
        console.error('Error renaming item:', err);
        ws.send(JSON.stringify({ type: 'error', message: `Failed to rename item: ${oldPath}` }));
    }
}