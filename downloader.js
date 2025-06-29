const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { JSDOM } = require("jsdom");

const targetUrl = process.argv[2];
if (!targetUrl) {
  console.log("使い方: node save-page.js https://example.com");
  process.exit(1);
}

const outDir = path.resolve(__dirname, "saved");
const assetDir = path.join(outDir, "assets");
fs.mkdirSync(assetDir, { recursive: true });

const visited = new Set();
const assetMap = {};

function sanitize(url) {
  return url.replace(/[^a-z0-9]/gi, "_").slice(0, 128);
}

async function downloadFile(url) {
  if (visited.has(url)) return assetMap[url];
  visited.add(url);

  try {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    const ext = path.extname(new URL(url).pathname).split("?")[0] || ".bin";
    const name = sanitize(url) + ext;
    const filePath = path.join(assetDir, name);
    fs.writeFileSync(filePath, res.data);
    const relative = "assets/" + name;
    assetMap[url] = relative;
    return relative;
  } catch (e) {
    console.warn("⚠️ ダウンロード失敗:", url);
    return url;
  }
}

async function parseCssAndDownload(cssText, baseUrl) {
  const urlPattern = /url\((['"]?)(.*?)\1\)/g;
  const importPattern = /@import\s+(?:url\()?['"]?(.*?)['"]?\)?;/g;
  const promises = [];

  cssText = cssText.replace(urlPattern, (match, quote, u) => {
    const abs = new URL(u, baseUrl).href;
    promises.push(
      downloadFile(abs).then(local => {
        cssText = cssText.replace(u, local);
      })
    );
    return match;
  });

  cssText = cssText.replace(importPattern, (match, u) => {
    const abs = new URL(u, baseUrl).href;
    promises.push(
      axios.get(abs).then(res => parseCssAndDownload(res.data, abs))
    );
    return match;
  });

  await Promise.all(promises);
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
        downloadFile(abs).then(local => {
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
      const local = await downloadFile(href);
      fs.writeFileSync(path.join(outDir, local), newCss);
    } catch (e) {}
  }

  await Promise.all(tasks);

  fs.writeFileSync(path.join(outDir, "index.html"), dom.serialize(), "utf8");
  console.log("✅ 完全保存完了: saved/index.html");
}

savePage(targetUrl);