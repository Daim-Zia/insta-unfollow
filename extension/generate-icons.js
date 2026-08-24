// Generate extension icons — run once: node generate-icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const outDir = path.join(__dirname, 'icons');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background circle
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#0095f6';
  ctx.fill();

  // Minus sign (unfollow)
  const barW = size * 0.4;
  const barH = size * 0.08;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect((size - barW) / 2, (size - barH) / 2, barW, barH);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), buf);
  console.log(`Created icon${size}.png`);
});

console.log('Done!');
