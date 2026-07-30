import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const questions = JSON.parse(readFileSync('../content/questions.json', 'utf-8'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });

async function seedAndGoto(index, screenshotName) {
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
  await page.waitForTimeout(1500);
  const beginBtn = page.getByText('Begin Zone', { exact: false });
  if (await beginBtn.isVisible().catch(() => false)) {
    await beginBtn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: screenshotName, fullPage: true });
}

await seedAndGoto(0, '_shot_case01_table.png');
await seedAndGoto(12, '_shot_case04_singletab.png');
await seedAndGoto(80, '_shot_l2case01_multientity.png');

await browser.close();
console.log('done');
