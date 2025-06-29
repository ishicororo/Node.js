const fs = require("fs");
const path = require("path");
const axios = require("axios");
const JSZip = require("jszip");
const { JSDOM } = require("jsdom");

const targetUrl = process.argv[2];
if (!targetUrl) {
  console.log("使い方: node downloader.js https://example.com");
  process.exit(1);
}

const origin = new URL(targetUrl).origin;
const domain = new URL(targetUrl).hostname.replace(/[^a-z0-9.-]/gi, "_");
const zip = new JSZip();
const visited = new Set();
const assetMap = {};

const rootSaveDir = path.join(__dirname, "saved", "files", domain);
const zipDir = path.join(__dirname, "saved", "zips");
fs.mkdirSync(rootSaveDir, { recursive: true });
fs.mkdirSync(zipDir, { recursive: true });

function sanitize(url) {
  return url.replace(/[^a-z0-9]/gi, "_").slice(0, 128);
}

async function downloadFile(url, referer) {
  if (visited.has(url)) return assetMap[url];
  visited.add(url);

  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36',
        'Referer': referer,
        'Origin': new URL(referer).origin
      }
    });

    const ext = path.extname(new URL(url).pathname).split("?")[0] || ".bin";
    const name = sanitize(url) + ext;
    const relative = path.join("assets", name);
    const localPath = path.join(rootSaveDir, relative);

    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, res.data);

    zip.file(relative, res.data);
    assetMap[url] = relative;
    return relative;
  } catch (e) {
    console.warn("⚠️ ダウンロード失敗:", url, "-", e.message);
    return url;
  }
}

async function parseCssAndDownload(cssText, baseUrl) {
  const urlPattern = /url\((['"]?)(.*?)\1\)/g;
  const importPattern = /@import\s+(?:url\()?['"]?(.*?)['"]?\)?;/g;
  const tasks = [];

  cssText = cssText.replace(urlPattern, (match, quote, u) => {
    const abs = new URL(u, baseUrl).href;
    const promise = downloadFile(abs, baseUrl).then(local => {
      cssText = cssText.replace(u, local);
    });
    tasks.push(promise);
    return match;
  });

  cssText = cssText.replace(importPattern, (match, u) => {
    const abs = new URL(u, baseUrl).href;
    const promise = axios.get(abs).then(res => parseCssAndDownload(res.data, abs));
    tasks.push(promise);
    return match;
  });

  await Promise.all(tasks);
  return cssText;
}

async function savePage(url) {
  console.log("🔗 HTML取得中:", url);
  const res = await axios.get(url);
  const dom = new JSDOM(res.data);
  const doc = dom.window.document;

  const tasks = [];

  for (const el of [...doc.querySelectorAll("link[href]"), ...doc.querySelectorAll("script[src]"), ...doc.querySelectorAll("img[src]")]) {
    const attr = el.getAttribute("href") || el.getAttribute("src");
    if (!attr || attr.startsWith("data:")) continue;

    try {
      const abs = new URL(attr, url).href;
      tasks.push(
        downloadFile(abs, url).then(local => {
          if (el.hasAttribute("href")) el.setAttribute("href", local);
          else el.setAttribute("src", local);
        })
      );
    } catch (e) {}
  }

  for (const el of doc.querySelectorAll("style")) {
    const css = el.textContent;
    tasks.push(
      parseCssAndDownload(css, url).then(replaced => {
        el.textContent = replaced;
      })
    );
  }

  for (const el of doc.querySelectorAll('link[rel="stylesheet"]')) {
    try {
      const href = new URL(el.href, url).href;
      const res = await axios.get(href);
      const newCss = await parseCssAndDownload(res.data, href);
      const local = await downloadFile(href, url);
      zip.file(local, newCss);
    } catch (e) {}
  }

  await Promise.all(tasks);

  const html = dom.serialize();
  const indexPath = path.join(rootSaveDir, "index.html");
  fs.writeFileSync(indexPath, html);
  zip.file("index.html", html);

  const outZip = path.join(zipDir, `${domain}.zip`);
  console.log("📦 ZIP作成中...");
  const blob = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(outZip, blob);

  console.log("✅ 完全保存完了:");
  console.log("📁 展開保存:", indexPath);
  console.log("📦 ZIP保存:", outZip);
}

savePage(targetUrl);