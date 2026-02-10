import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const themePath = path.join(rootDir, 'src', 'styles', 'theme.css');

const css = fs.readFileSync(themePath, 'utf8');
const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
const vars = new Map();
let match;

while ((match = varRegex.exec(css)) !== null) {
  vars.set(`--${match[1]}`, match[2].trim());
}

const parseChannel = (value) => {
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    return Math.round((parseFloat(trimmed) / 100) * 255);
  }
  return Math.round(parseFloat(trimmed));
};

const parseAlpha = (value) => {
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    return Math.max(0, Math.min(1, parseFloat(trimmed) / 100));
  }
  return Math.max(0, Math.min(1, parseFloat(trimmed)));
};

const parseColor = (value) => {
  if (!value) {
    throw new Error('Missing color value.');
  }
  const trimmed = value.trim();
  if (trimmed.startsWith('var(')) {
    const key = trimmed.slice(4, -1).trim();
    return parseColor(vars.get(key));
  }
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    throw new Error(`Unsupported hex color: ${trimmed}`);
  }
  if (trimmed.startsWith('rgb')) {
    const parts = trimmed
      .replace(/rgba?\(/, '')
      .replace(')', '')
      .split(',')
      .map((part) => part.trim());
    const r = parseChannel(parts[0]);
    const g = parseChannel(parts[1]);
    const b = parseChannel(parts[2]);
    const a = parts[3] ? parseAlpha(parts[3]) : 1;
    return { r, g, b, a };
  }
  throw new Error(`Unsupported color format: ${trimmed}`);
};

const blend = (fg, bg) => {
  const alpha = fg.a;
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
    a: 1
  };
};

const toLinear = (value) => {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
};

const luminance = (color) =>
  0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);

const contrastRatio = (fg, bg) => {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const checks = [
  { name: 'Text on Background', fg: '--text', bg: '--bg', min: 4.5 },
  { name: 'Text on Surface', fg: '--text', bg: '--surface', min: 4.5 },
  { name: 'Muted Text on Surface', fg: '--text-muted', bg: '--surface', min: 4.5 },
  { name: 'Border on Surface', fg: '--border', bg: '--surface', min: 3.0 },
  { name: 'Primary Button Text', fg: '--primary-fg', bg: '--primary', min: 4.5 },
  { name: 'Focus Ring on Background', fg: '--focus-ring', bg: '--bg', min: 3.0 }
];

const results = [];
let failed = false;

for (const check of checks) {
  const fgColor = parseColor(vars.get(check.fg));
  const bgColor = parseColor(vars.get(check.bg));
  const blendedFg = fgColor.a < 1 ? blend(fgColor, bgColor) : fgColor;
  const ratio = contrastRatio(blendedFg, bgColor);
  const pass = ratio >= check.min;
  results.push({ ...check, ratio, pass });
  if (!pass) {
    failed = true;
  }
}

results.forEach((result) => {
  const status = result.pass ? 'PASS' : 'FAIL';
  console.log(`${status} ${result.name}: ${result.ratio.toFixed(2)} (min ${result.min})`);
});

if (failed) {
  process.exit(1);
}
