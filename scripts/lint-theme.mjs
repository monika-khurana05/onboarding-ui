import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');

const allowedHexFiles = new Set([path.join(srcDir, 'styles', 'theme.css')]);
const scanExtensions = new Set(['.ts', '.tsx', '.css']);

const hexRegex = /#[0-9A-Fa-f]{3,8}\b/g;
const paletteRegex =
  /\b(?:bg|text|border|ring|outline|shadow|from|to|via|fill|stroke)-(?:slate|zinc|gray|blue|neutral|stone)-\d{2,3}(?:\/\d{1,3})?\b/g;

const hexFindings = [];
const paletteFindings = [];

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      walk(fullPath);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!scanExtensions.has(ext)) {
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    const relPath = path.relative(rootDir, fullPath);
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (hexRegex.test(line) && !allowedHexFiles.has(fullPath)) {
        hexFindings.push({
          file: relPath,
          line: lineNumber,
          text: line.trim()
        });
      }
      if (paletteRegex.test(line)) {
        paletteFindings.push({
          file: relPath,
          line: lineNumber,
          text: line.trim()
        });
      }
      hexRegex.lastIndex = 0;
      paletteRegex.lastIndex = 0;
    });
  }
};

walk(srcDir);

const printFindings = (label, items) => {
  console.error(label);
  items.slice(0, 50).forEach((item) => {
    console.error(`- ${item.file}:${item.line} ${item.text}`);
  });
  if (items.length > 50) {
    console.error(`...and ${items.length - 50} more`);
  }
};

let hasErrors = false;
if (hexFindings.length > 0) {
  hasErrors = true;
  printFindings('Hex colors found outside theme tokens:', hexFindings);
}
if (paletteFindings.length > 0) {
  hasErrors = true;
  printFindings('Non-semantic Tailwind palette classes found:', paletteFindings);
}

if (hasErrors) {
  process.exit(1);
}

console.log('Theme lint passed.');
