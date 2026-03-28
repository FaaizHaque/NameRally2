/**
 * Patches react-native-google-mobile-ads spec files to replace Promise<void>
 * with Promise<null>, which is required for React Native 0.79+ strict codegen.
 *
 * RN 0.79 codegen treats void as undefined in generic positions, causing:
 * "UnsupportedGenericParserError: Unrecognized generic type 'undefined'"
 */
const fs = require('fs');
const path = require('path');

const specsDir = path.join(
  __dirname,
  '../node_modules/react-native-google-mobile-ads/src/specs/modules'
);

if (!fs.existsSync(specsDir)) {
  console.log('[patch-google-ads] specs dir not found, skipping');
  process.exit(0);
}

const files = fs.readdirSync(specsDir).filter((f) => f.endsWith('.ts'));
let patched = 0;

for (const file of files) {
  const filePath = path.join(specsDir, file);
  const original = fs.readFileSync(filePath, 'utf8');
  if (original.includes('Promise<void>')) {
    const fixed = original.replace(/Promise<void>/g, 'Promise<null>');
    fs.writeFileSync(filePath, fixed);
    console.log(`[patch-google-ads] patched ${file}`);
    patched++;
  }
}

if (patched === 0) {
  console.log('[patch-google-ads] nothing to patch');
} else {
  console.log(`[patch-google-ads] done — ${patched} file(s) patched`);
}
