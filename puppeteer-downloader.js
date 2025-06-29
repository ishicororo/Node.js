const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { URL } = require("url");

const targetUrl = process.argv[2];
if (!targetUrl) {
  console.error("使用法: node save-complete.js https://example.com");
  process.exit(1);
}

const outputDir = path.resolve(__dirname, "saved");
const resourceDir = path.join(outputDir, "resources");
fs.mkdirSync(resourceDir, { recursive: true });

function sanitizeFilename(url) {
  return url.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 128);
}

async function downloadResource(url) {
  try {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    const ext = path.extname(new URL(url).pathname).split("?")[0] || ".bin";
    const filename = sanitizeFilename(url) + ext;
    const filePath = path.join(resourceDir, filename);
    fs.writeFileSync(filePath, res.data);
    return "resources/" + filename;
  } catch (e) {
    console.warn("⚠️ ダウンロード失敗:", url);
    return null;
  }
}

function replaceResourceUrls(html, mapping) {
  for (const [original, local] of Object.entries(mapping)) {
    html = html.split(original).join(local);
  }
  return html;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  console.log("🚀 ページ読み込み中:", targetUrl);
  await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 0 });

  const html = await page.content();
  const resourceUrls = await page.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll("img[src],link[href],script[src]").forEach(el => {
      const src = el.src || el.href;
      if (src && !src.startsWith("data:")) urls.add(src);
    });
    return Array.from(urls);
  });

  console.log("📦 リソース収集中:", resourceUrls.length, "件");

  const urlMap = {};
  for (const url of resourceUrls) {
    const localPath = await downloadResource(url);
    if (localPath) {
      urlMap[url] = localPath;
    }
  }

  // CSS内の URL() や @import 対応もここで拡張可能（必要なら言ってください）

  const newHtml = replaceResourceUrls(html, urlMap);
  fs.writeFileSync(path.join(outputDir, "index.html"), newHtml, "utf8");
  console.log("✅ 完了: saved/index.html に保存されました");

  await browser.close();
})();