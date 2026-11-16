// One-shot mojibake repair for UTF-8 text mis-decoded as Windows-1252.
// cp1252 differs from Latin-1 in the 0x80-0x9F range (e.g. â‚¬ = 0x80,
// right-double-quote = 0x94). We reverse-map chars to cp1252 bytes, then
// decode those bytes as UTF-8.
import { readFileSync, writeFileSync } from 'node:fs';

const CP1252_EXTRA = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F
};

function charToCp1252Byte(cp) {
  if (cp <= 0xFF) return cp;            // U+0000..U+00FF map 1:1
  if (CP1252_EXTRA[cp] !== undefined) return CP1252_EXTRA[cp];
  return null;                           // unmappable
}

function repair(str) {
  const bytes = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp > 0x7F) {
      const b = charToCp1252Byte(cp);
      if (b === null) return null;       // contains real non-cp1252 chars; skip
      bytes.push(b);
    } else {
      bytes.push(cp);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

for (const f of process.argv.slice(2)) {
  const original = readFileSync(f, 'utf8');
  const guess = repair(original);
  // Only accept if the result actually reduces mojibake and has no U+FFFD.
  const bad = !guess || guess.includes('\uFFFD');
  if (!bad && guess !== original) {
    writeFileSync(f, guess, 'utf8');
    console.log(`repaired: ${f}`);
  } else {
    console.log(`unchanged: ${f}`);
  }
}
