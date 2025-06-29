const fs = require("fs");
const path = require("path");
const axios = require("axios");
const JSZip = require("jszip");
const { JSDOM } = require("jsdom");

const visited = new Set();
const assets = new Set();
const zip = new JSZip();
const origin = new URL(process.argv[2]).origin;

function toZipPath(url) {
  try {
    const u = new URL(url);
    if (u.origin !== origin) return null;
    let p = u.pathname;
    if (p.endsWith("/")) p += "index.html";
    return decodeURIComponent(p).replace(/^\/+/, "");
  } catch {
    return null;
  }
}

async function fetchFile(url, baseUrl) {
  if (visited.has(url)) return;
  visited.add(url);
  try {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    const zipPath = toZipPath(url);
    if (!zipPath) return;

    const contentType = res.headers["content-type"] || "";

    if (contentType.includes("text/html")) {
      const html = res.data.toString();
      zip.file(zipPath, html);
      await parseHTML(html, url);
    } else if (contentType.includes("text/css")) {
      const css = res.data.toString();
      zip.file(zipPath, css);
      await parseCSS(css, url);
    } else {
      zip.file(zipPath, res.data);
    }
  } catch (e) {
    console.warn("Fetch failed:", url, "-", e.message);
  }
}

async function parseHTML(html, baseUrl) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const selectors = [
    ["link[href]", "href"],
    ["script[src]", "src"],
    ["img[src]", "src"],
    ["a[href]", "href"],
    ["iframe[src]", "src"],
  ];

  for (const [sel, attr] of selectors) {
    const elements = doc.querySelectorAll(sel);
    for (const el of elements) {
      const ref = el.getAttribute(attr);
      if (!ref || ref.startsWith("data:")) continue;
      try {
        const abs = new URL(ref, baseUrl).href;
        if (abs.startsWith(origin)) assets.add(abs);
      } catch {}
    }
  }
}

async function parseCSS(css, baseUrl) {
  const urlRe = /url\(["']?(.+?)["']?\)/g;
  let m;
  while ((m = urlRe.exec(css))) {
    try {
      const abs = new URL(m[1], baseUrl).href;
      if (abs.startsWith(origin)) assets.add(abs);
    } catch {}
  }
}

async function crawl(startUrl) {
  console.log("開始:", startUrl);
  await fetchFile(startUrl, startUrl);

  for (const url of Array.from(assets)) {
    await fetchFile(url, startUrl);
  }

  const zipFile = path.basename(new URL(startUrl).hostname) + ".zip";
  const blob = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(zipFile, blob);
  console.log("保存完了:", zipFile);
}

// 実行
if (!process.argv[2]) {
  console.error("使用法: node site-downloader.js https://example.com");
  process.exit(1);
}

crawl(process.argv[2]);