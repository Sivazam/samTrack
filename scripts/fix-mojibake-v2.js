/**
 * fix-mojibake-v2.js
 * 
 * Fixes remaining UTF-8 mojibake (double/triple encoding corruption) in
 * WholesalerAdminDashboard.tsx after a first round of Ã-prefix decoding.
 *
 * Uses exact Unicode codepoint sequences derived from hex analysis.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'WholesalerAdminDashboard.tsx');

console.log('=== Mojibake Fix v2 ===\n');
console.log('File:', filePath);

let content = fs.readFileSync(filePath, 'utf8');
const originalLength = content.length;

let totalReplacements = 0;

function replaceAndCount(pattern, replacement, label) {
  const matches = content.match(pattern);
  const count = matches ? matches.length : 0;
  content = content.replace(pattern, replacement);
  totalReplacements += count;
  console.log(`  [${count > 0 ? 'FIXED' : 'skip'}] ${label}: ${count} replacement(s)`);
  return count;
}

console.log('\n--- 4-byte emoji patterns (longest sequences first) ---\n');

// 🔔 variant with ž ending (lines 207, 793, 1409, 2571)
// Codepoints: F0 178 E2 20AC 9D E2 20AC 17E
replaceAndCount(
  /\u00F0\u0178\u00E2\u20AC\u009D\u00E2\u20AC\u017E/g,
  '\u{1F514}',  // 🔔
  '\u{1F514} bell (\u017E variant)'
);

// 🔔 variant with 9D ending (lines 1024, 1095, 1096, 1103, 1119, 1135, 1316, 1320, 1321, 1330, 1331, 1336)
// Codepoints: F0 178 E2 20AC 9D E2 20AC 9D
replaceAndCount(
  /\u00F0\u0178\u00E2\u20AC\u009D\u00E2\u20AC\u009D/g,
  '\u{1F514}',  // 🔔
  '\u{1F514} bell (9D variant)'
);

// 🔕 no-bell (line 1423)
// Codepoints: F0 178 E2 20AC 9D E2 20AC A2
replaceAndCount(
  /\u00F0\u0178\u00E2\u20AC\u009D\u00E2\u20AC\u00A2/g,
  '\u{1F515}',  // 🔕
  '\u{1F515} no-bell'
);

// 🔗 link (line 1638)
// Codepoints: F0 178 E2 20AC 9D E2 20AC 201D
replaceAndCount(
  /\u00F0\u0178\u00E2\u20AC\u009D\u00E2\u20AC\u201D/g,
  '\u{1F517}',  // 🔗
  '\u{1F517} link'
);

// 🔧 wrench (line 2540)
// Codepoints: F0 178 E2 20AC 9D C2 A7
replaceAndCount(
  /\u00F0\u0178\u00E2\u20AC\u009D\u00C2\u00A7/g,
  '\u{1F527}',  // 🔧
  '\u{1F527} wrench'
);

console.log('\n--- 3-byte symbol patterns ---\n');

// ⚠️ warning with variation selector (line 1795)
// Codepoints: 26A0 EF B8 C2 8F  →  26A0 FE0F
replaceAndCount(
  /\u26A0\u00EF\u00B8\u00C2\u008F/g,
  '\u26A0\uFE0F',  // ⚠️
  '\u26A0\uFE0F warning sign'
);

// ❌ cross mark (lines 1562, 1664, 1714, 1904, 2584, 2587, 3867)
// Codepoints: E2 C2 9D C5 2019
replaceAndCount(
  /\u00E2\u00C2\u009D\u00C5\u2019/g,
  '\u274C',  // ❌
  '\u274C cross mark'
);

// ⏳ hourglass (line 3681)
// Codepoints: E2 C2 8F C2 B3
replaceAndCount(
  /\u00E2\u00C2\u008F\u00C2\u00B3/g,
  '\u23F3',  // ⏳
  '\u23F3 hourglass'
);

console.log('\n--- Em dash patterns ---\n');

// — em dash (lines 426, 469, 482, 754, 794, 1168, 1413, 1800, 2929, 3629×2, 3653)
// Codepoints: E2 20AC E2 20AC 9D
replaceAndCount(
  /\u00E2\u20AC\u00E2\u20AC\u009D/g,
  '\u2014',  // —
  '\u2014 em dash'
);

console.log('\n=== Results ===\n');
console.log(`Total replacements: ${totalReplacements}`);
console.log(`Original length: ${originalLength}`);
console.log(`New length:      ${content.length}`);
console.log(`Chars removed:   ${originalLength - content.length}`);

// Write the fixed file (UTF-8, no BOM)
fs.writeFileSync(filePath, content, 'utf8');
console.log('\nFile written successfully.');

// ─── Verification ───────────────────────────────────────────────────────────

console.log('\n=== Post-fix Verification ===\n');

const lines = content.split('\n');

// Check for remaining mojibake indicator sequences
const checks = [
  { pattern: /\u00F0\u0178/g,                label: '\u00F0\u0178 (4-byte emoji mojibake start)' },
  { pattern: /\u00E2\u20AC\u00E2\u20AC/g,    label: '\u00E2\u20AC\u00E2\u20AC (em-dash mojibake)' },
  { pattern: /\u00E2\u00C2\u009D/g,          label: '\u00E2\u00C2\u009D (cross-mark mojibake)' },
  { pattern: /\u00EF\u00B8\u00C2\u008F/g,    label: '\u00EF\u00B8 (variation selector mojibake)' },
  { pattern: /\u00E2\u00C2\u008F\u00C2/g,    label: '\u00E2\u00C2\u008F (hourglass mojibake)' },
];

let allClean = true;
for (const { pattern, label } of checks) {
  const m = content.match(pattern);
  const count = m ? m.length : 0;
  if (count > 0) {
    allClean = false;
    console.log(`  [REMAINING] ${label}: ${count}`);
  } else {
    console.log(`  [CLEAN]     ${label}: 0`);
  }
}

// Spot-check key user-visible lines
console.log('\n--- Spot-check user-visible lines ---\n');
const spotChecks = [
  { line: 1795, desc: 'confirm dialog (should have \u26A0\uFE0F)' },
  { line: 1904, desc: 'assignment details (should have \u274C)' },
  { line: 3629, desc: 'areaName fallback (should have \u2014)' },
  { line: 3653, desc: 'DetailRow value (should have \u2014)' },
  { line: 3681, desc: 'pending review badge (should have \u23F3)' },
  { line: 1562, desc: 'console.error (should have \u274C)' },
];

for (const { line, desc } of spotChecks) {
  const l = lines[line - 1];
  if (l) {
    // Check for mojibake indicators
    let clean = true;
    for (let i = 0; i < l.length; i++) {
      const cp = l.codePointAt(i);
      if (cp === 0x00F0 || cp === 0x0178 ||
          (cp === 0x00C2 && i + 1 < l.length && l.codePointAt(i + 1) < 0xA0) ||
          (cp >= 0x0080 && cp <= 0x009F)) {
        clean = false;
        break;
      }
    }
    const status = clean ? 'OK' : 'MOJIBAKE?';
    console.log(`  [${status}] L${line} (${desc}):`);
    console.log(`         ${l.trim().substring(0, 120)}`);
  }
}

// Global scan for remaining suspicious non-ASCII
console.log('\n--- Remaining lines with potential mojibake ---\n');
let suspiciousCount = 0;
lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  let hasMojibake = false;

  for (let i = 0; i < line.length; i++) {
    const cp = line.codePointAt(i);
    // ð (U+00F0) followed by Ÿ (U+0178) — 4-byte emoji mojibake
    if (cp === 0x00F0 && i + 1 < line.length && line.codePointAt(i + 1) === 0x0178) {
      hasMojibake = true;
      break;
    }
    // Â (U+00C2) followed by C1 control char (U+0080-009F) — double encoding residue
    if (cp === 0x00C2 && i + 1 < line.length) {
      const next = line.codePointAt(i + 1);
      if (next >= 0x0080 && next <= 0x009F) {
        hasMojibake = true;
        break;
      }
    }
    //  â€â€ pattern (em-dash mojibake)
    if (cp === 0x00E2 && i + 2 < line.length &&
        line.codePointAt(i + 1) === 0x20AC &&
        line.codePointAt(i + 2) === 0x00E2) {
      hasMojibake = true;
      break;
    }
  }

  if (hasMojibake) {
    suspiciousCount++;
    console.log(`  L${lineNum}: ${line.trim().substring(0, 140)}`);
  }
});

if (suspiciousCount === 0) {
  console.log('  None found! File is clean.');
} else {
  console.log(`\n  Total suspicious lines remaining: ${suspiciousCount}`);
}

console.log('\n=== Done ===\n');
