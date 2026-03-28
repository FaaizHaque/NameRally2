/**
 * Patches react-native-google-mobile-ads spec files for React Native 0.79+ codegen.
 *
 * Two fixes needed:
 * 1. Promise<void> → Promise<null>
 *    RN 0.79 codegen treats void as undefined in generic positions.
 * 2. CodegenTypes.UnsafeObject → Object
 *    RN 0.79 codegen can't resolve the CodegenTypes namespace, evaluating it
 *    as undefined → "Unrecognized generic type 'undefined'".
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
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (content.includes('Promise<void>')) {
    content = content.replace(/Promise<void>/g, 'Promise<null>');
    changed = true;
  }
  if (content.includes('CodegenTypes.UnsafeObject')) {
    content = content.replace(/CodegenTypes\.UnsafeObject/g, 'Object');
    changed = true;
  }
  // Remove the now-unused CodegenTypes import to avoid parser confusion
  if (content.includes("import type { CodegenTypes }")) {
    content = content.replace(/import type \{ CodegenTypes \} from 'react-native';\n?/g, '');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`[patch-google-ads] patched ${file}`);
    patched++;
  }
}

if (patched === 0) {
  console.log('[patch-google-ads] nothing to patch');
} else {
  console.log(`[patch-google-ads] done — ${patched} file(s) patched`);
}
