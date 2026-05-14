/**
 * Fix UTF-8 double-encoding (mojibake) in WholesalerAdminDashboard.tsx
 * 
 * The file has characters that were: UTF-8 → misread as CP1252 → re-encoded as UTF-8
 * This script reverses that process.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'WholesalerAdminDashboard.tsx');

// CP1252 special mappings: Unicode codepoint → original byte value
// These handle the 0x80-0x9F range where CP1252 differs from Latin-1
const cp1252ToByte = {
  0x20AC: 0x80, // €
  // 0x81 is undefined in CP1252
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8A, // Š
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  // 0x8D undefined
  0x017D: 0x8E, // Ž

  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201C: 0x93, // "
  0x201D: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02DC: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9A, // š
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  // 0x9D undefined
  0x017E: 0x9E, // ž
  0x0178: 0x9F, // Ÿ
};

function charToCp1252Byte(ch) {
  const cp = ch.codePointAt(0);
  // ASCII range
  if (cp < 0x80) return cp;
  // Latin-1 supplement (matches CP1252 for 0xA0-0xFF)
  if (cp >= 0xA0 && cp <= 0xFF) return cp;
  // CP1252 special range
  const mapped = cp1252ToByte[cp];
  if (mapped !== undefined) return mapped;
  return -1; // unmappable
}

function tryDecodeMojibake(str) {
  const bytes = [];
  for (const ch of str) {
    const b = charToCp1252Byte(ch);
    if (b < 0) return null;
    bytes.push(b);
  }
  const buf = Buffer.from(bytes);
  const decoded = buf.toString('utf8');
  // Check for replacement characters (would indicate invalid UTF-8)
  if (decoded.includes('\uFFFD')) return null;
  return decoded;
}

// Read the file
let content = fs.readFileSync(filePath, 'utf8');
const originalLength = content.length;

console.log(`Reading: ${filePath}`);
console.log(`Original length: ${originalLength} chars`);

// Strategy: find sequences starting with characters that could be
// the first byte of a multi-byte UTF-8 sequence when double-encoded.
// In double-encoded UTF-8, the first byte (0xC0-0xF4) becomes
// a 2-byte UTF-8 sequence starting with Ã (0xC3) or Ã° for 4-byte originals.
//
// We look for Ã (U+00C3) or other high Latin chars followed by non-ASCII chars,
// try progressively longer sequences, and pick the longest valid decode.

let fixes = 0;
const fixLog = [];

// Match Ã followed by non-ASCII characters (greedy)
// Also match Ã° which starts 4-byte UTF-8 sequences
content = content.replace(/[\u00C0-\u00F4][\u0080-\u00FF\u0100-\u017F\u0192\u02C6\u02DC\u2013-\u2026\u2030\u2039\u203A\u2018-\u201E\u2022\u2122\u0152\u0153\u0160\u0161\u017D\u017E\u0178\u20AC]+/g, (match) => {
  // Try to decode the entire match
  const decoded = tryDecodeMojibake(match);
  if (decoded && decoded !== match && decoded.length < match.length) {
    fixes++;
    fixLog.push(`  [${fixes}] "${match}" → "${decoded}"`);
    return decoded;
  }
  
  // Try progressively shorter prefixes
  for (let len = match.length - 1; len >= 2; len--) {
    const sub = match.substring(0, len);
    const decoded = tryDecodeMojibake(sub);
    if (decoded && decoded !== sub && decoded.length < sub.length) {
      fixes++;
      const rest = match.substring(len);
      fixLog.push(`  [${fixes}] "${sub}" → "${decoded}" (rest: "${rest}")`);
      return decoded + rest;
    }
  }
  
  return match;
});

console.log(`\nFixes applied: ${fixes}`);
fixLog.forEach(l => console.log(l));
console.log(`\nNew length: ${content.length} chars (was ${originalLength})`);

if (fixes > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\nFile saved successfully.');
  
  // Verify no Ã remains in mojibake context
  const remaining = (content.match(/Ã[^\x00-\x7F]/g) || []).length;
  console.log(`Remaining Ã+non-ASCII sequences: ${remaining}`);
} else {
  console.log('\nNo fixes needed.');
}
