#!/usr/bin/env node
/**
 * Regenerate ALL PWA icon files from a single square source image.
 *
 * Usage:
 *   1. Drop a high-res square PNG (≥ 512×512, transparent or solid bg)
 *      at:   public/icon-source.png
 *   2. Run:  node scripts/generate-pwa-icons.js
 *
 * Produces:
 *   - public/icon-{48,72,96,128,144,152,192,256,384,512}.png  (any-purpose)
 *   - public/icon-maskable-{192,512}.png  (with safe-zone padding for Android adaptive)
 *   - public/apple-touch-icon.png  (180×180, white background — required by iOS)
 *   - public/favicon.ico  (32×32 fallback)
 *   - public/notification-large-{192x192,2x-384x384}.png
 *   - public/notification-small-{24x24,2x-48x48}.png
 *   - public/badge-{72x72,2x-144x144}.png  (monochrome silhouette for status bar)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SOURCE_CANDIDATES = [
  'icon-source.png', 'icon-source.jpg', 'icon-source.jpeg', 'icon-source.webp',
  'logo-icon.png', 'logo-icon.jpg',
  'logoMain.png',
];

const STANDARD_SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512];
const MASKABLE_SIZES = [192, 512];           // Android adaptive icons
const APPLE_SIZE = 180;
const NOTIF_LARGE = [192, 384];
const NOTIF_SMALL = [24, 48];
const BADGE_SIZES = [72, 144];

const BG_LIGHT = { r: 248, g: 250, b: 252, alpha: 1 };  // matches manifest background_color
const BG_BRAND = { r: 5, g: 150, b: 105, alpha: 1 };    // emerald-600 (theme_color)

function findSource() {
  for (const name of SOURCE_CANDIDATES) {
    const p = path.join(PUBLIC_DIR, name);
    if (fs.existsSync(p)) return { path: p, name };
  }
  return null;
}

async function main() {
  const src = findSource();
  if (!src) {
    console.error('❌ No source image found.');
    console.error('   Please save a square logo (≥512x512) at one of:');
    SOURCE_CANDIDATES.forEach(n => console.error(`   - public/${n}`));
    process.exit(1);
  }
  console.log(`🎨 Using source: ${src.name}`);

  const meta = await sharp(src.path).metadata();
  console.log(`   Source: ${meta.width}×${meta.height} ${meta.format}`);
  if ((meta.width || 0) < 256 || (meta.height || 0) < 256) {
    console.warn('⚠️  Source is small — icons may look blurry. Recommend ≥512×512.');
  }

  // 1. Standard "any-purpose" square icons (transparent fit on bg-light)
  for (const size of STANDARD_SIZES) {
    const out = path.join(PUBLIC_DIR, `icon-${size}x${size}.png`);
    await sharp(src.path)
      .resize(size, size, { fit: 'contain', background: BG_LIGHT })
      .flatten({ background: BG_LIGHT })
      .png({ compressionLevel: 9, quality: 95 })
      .toFile(out);
    console.log(`✅ icon-${size}x${size}.png`);
  }

  // 2. Maskable icons (Android adaptive) — must have safe zone (~80% inside, 10% padding each side)
  for (const size of MASKABLE_SIZES) {
    const out = path.join(PUBLIC_DIR, `icon-maskable-${size}x${size}.png`);
    const inner = Math.round(size * 0.8);
    const innerBuf = await sharp(src.path)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: BG_BRAND },
    })
      .composite([{ input: innerBuf, gravity: 'center' }])
      .png({ compressionLevel: 9, quality: 95 })
      .toFile(out);
    console.log(`✅ icon-maskable-${size}x${size}.png`);
  }

  // 3. Apple touch icon (no transparency on iOS — solid white bg)
  const appleOut = path.join(PUBLIC_DIR, 'apple-touch-icon.png');
  await sharp(src.path)
    .resize(APPLE_SIZE, APPLE_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ compressionLevel: 9, quality: 95 })
    .toFile(appleOut);
  console.log(`✅ apple-touch-icon.png (${APPLE_SIZE}×${APPLE_SIZE})`);

  // 4. Favicon (32x32 PNG — Next.js & most browsers accept .png at /favicon.ico)
  const faviconOut = path.join(PUBLIC_DIR, 'favicon.ico');
  await sharp(src.path)
    .resize(32, 32, { fit: 'contain', background: BG_LIGHT })
    .flatten({ background: BG_LIGHT })
    .png({ compressionLevel: 9 })
    .toFile(faviconOut);
  console.log(`✅ favicon.ico (32×32)`);

  // 5. Notification large icons (right-side big icon in push notifications)
  for (const size of NOTIF_LARGE) {
    const name = size === 192 ? 'notification-large-192x192' : 'notification-large-2x-384x384';
    const out = path.join(PUBLIC_DIR, `${name}.png`);
    await sharp(src.path)
      .resize(size, size, { fit: 'contain', background: BG_LIGHT })
      .flatten({ background: BG_LIGHT })
      .png({ compressionLevel: 9, quality: 95 })
      .toFile(out);
    console.log(`✅ ${name}.png`);
  }

  // 6. Notification small icons (left-side small icon)
  for (const size of NOTIF_SMALL) {
    const name = size === 24 ? 'notification-small-24x24' : 'notification-small-2x-48x48';
    const out = path.join(PUBLIC_DIR, `${name}.png`);
    await sharp(src.path)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`✅ ${name}.png`);
  }

  // 7. Badge icons (status-bar — should be monochrome white silhouette on transparent)
  for (const size of BADGE_SIZES) {
    const name = size === 72 ? 'badge-72x72' : 'badge-2x-144x144';
    const out = path.join(PUBLIC_DIR, `${name}.png`);
    await sharp(src.path)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .greyscale()
      .threshold(180)  // turn into silhouette
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`✅ ${name}.png`);
  }

  console.log('\n🎉 All PWA icons regenerated successfully!');
  console.log('   Don\'t forget to bump the SW cache version (CACHE_NAME) in public/sw.js');
  console.log('   so users get the new icons.');
}

main().catch(err => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
