const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// JSONリクエストと静的ファイルを提供するためのミドルウェア
app.use(express.json());
app.use(express.static('public'));

app.post('/run', (req, res) => {
    const code = req.body.code;

    if (!code) {
        return res.status(400).json({ error: 'コードがありません。' });
    }

    // --- ここからが危険な部分 ---
    // 一時的なファイルにコードを書き込む
    const tempFilePath = path.join(__dirname, `temp_${Date.now()}.js`);
    fs.writeFileSync(tempFilePath, code);

    // nodeコマンドで一時ファイルを実行する
    // タイムアウトを設定して無限ループなどに対応 (例: 5秒)
    exec(`node ${tempFilePath}`, { timeout: 5000 }, (error, stdout, stderr) => {
        // 実行後、一時ファイルを必ず削除する
        fs.unlinkSync(tempFilePath);

        if (error) {
            // 実行時エラー (コードのエラーやタイムアウトなど)
            console.error(`Execution error: ${error.message}`);
            return res.status(200).json({ output: `実行時エラー:\n${error.message}\n${stderr}` });
        }
        if (stderr) {
            // 標準エラー出力
            console.warn(`Stderr: ${stderr}`);
            return res.status(200).json({ output: `標準エラー出力:\n${stderr}` });
        }
        
        // 正常終了
        res.status(200).json({ output: stdout });
    });
    // --- ここまでが危険な部分 ---
});

app.listen(port, () => {
    console.log(`サーバーがポート ${port} で起動しました。`);
    console.log(`http://localhost:${port} を開いてください。`);
    console.log('【警告】このサーバーはセキュリティ的に脆弱です。ローカルでの学習目的にのみ使用してください。');
});