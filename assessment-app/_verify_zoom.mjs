import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const questions = JSON.parse(readFileSync('../content/questions.json', 'utf-8'));

async function shot(index, name) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000');
  await page.evaluate(({ questions, index }) => {
    localStorage.setItem('fs_attempt_id', 'debug-attempt');
    localStorage.setItem('fs_name', 'Debug Tester');
    localStorage.setItem('fs_email', 'debug@example.com');
    localStorage.setItem('fs_questions', JSON.stringify(questions));
    localStorage.setItem('fs_current_index', String(index));
    localStorage.setItem('fs_answers', JSON.stringify({}));
    localStorage.setItem('fs_xp', '0');
    localStorage.setItem('fs_test_active', 'true');
  }, { questions, index });
  await page.reload();
  await page.waitForTimeout(1200);
  const beginBtn = page.getByText('Begin Zone', { exact: false });
  if (await beginBtn.isVisible().catch(() => false)) {
    await beginBtn.click();
    await page.waitForTimeout(600);
  }
  const dashHeader = page.getByText('Case Review Dashboard');
  const box = await dashHeader.locator('xpath=ancestor::*[contains(@class,"rounded-2xl")]').first().boundingBox();
  if (box) {
    await page.screenshot({ path: name, clip: { x: box.x, y: box.y, width: box.width, height: box.height + 20 } });
  } else {
    await page.screenshot({ path: name, fullPage: true });
  }
  await browser.close();
}

await shot(0, '_shot_case01_zoom.png');
await shot(12, '_shot_case04_zoom.png');
await shot(80, '_shot_l2case01_zoom.png');
console.log('done');
