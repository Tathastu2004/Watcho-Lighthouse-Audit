// open-reports.js
// Opens all HTML reports in the reports directory and subfolders
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const reportsDir = path.resolve('./reports');

function openHtmlFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      openHtmlFiles(fullPath);
    } else if (file.endsWith('.html')) {
      // Windows: use 'start' to open in default browser
      exec(`start "" "${fullPath}"`);
    }
  }
}

openHtmlFiles(reportsDir);
console.log('Opening all HTML reports...');
