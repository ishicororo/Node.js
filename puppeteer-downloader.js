const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const url = process.argv[2];

if (!url) {
  console.error("使用法: node puppeteer-downloader.js https://example.com");
  process.exit(1);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  console.log("ページ読み込み中:", url);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  const title = await page.title();
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_") || "downloaded_page";

  // HTMLを保存
  const html = await page.content();
  const htmlPath = path.resolve(__dirname, `${safeTitle}.html`);
  fs.writeFileSync(htmlPath, html, "utf8");
  console.log("HTML保存完了:", htmlPath);

  // スクリーンショット保存（任意）
  const screenshotPath = path.resolve(__dirname, `${safeTitle}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("スクリーンショット保存完了:", screenshotPath);

  // PDF保存（任意）
  const pdfPath = path.resolve(__dirname, `${safeTitle}.pdf`);
  await page.pdf({ path: pdfPath, format: "A4" });
  console.log("PDF保存完了:", pdfPath);

  await browser.close();
})();