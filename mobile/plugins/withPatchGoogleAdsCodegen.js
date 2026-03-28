/**
 * Expo config plugin — patches react-native-google-mobile-ads spec files
 * to replace Promise<void> with Promise<null>.
 *
 * React Native 0.79 strict codegen rejects Promise<void> (treats void as
 * undefined internally → "Unrecognized generic type 'undefined'").
 *
 * This plugin runs during `expo prebuild`, BEFORE pod install + codegen,
 * so it works even when EAS skips bun install due to node_modules cache.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withPatchGoogleAdsCodegen = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const specsDir = path.join(
        config.modRequest.projectRoot,
        'node_modules/react-native-google-mobile-ads/src/specs/modules'
      );

      if (!fs.existsSync(specsDir)) {
        console.log('[withPatchGoogleAdsCodegen] specs dir not found, skipping');
        return config;
      }

      const files = fs.readdirSync(specsDir).filter((f) => f.endsWith('.ts'));
      let patched = 0;

      for (const file of files) {
        const filePath = path.join(specsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('Promise<void>')) {
          fs.writeFileSync(filePath, content.replace(/Promise<void>/g, 'Promise<null>'));
          console.log(`[withPatchGoogleAdsCodegen] patched ${file}`);
          patched++;
        }
      }

      console.log(`[withPatchGoogleAdsCodegen] done — ${patched} file(s) patched`);
      return config;
    },
  ]);
};

module.exports = withPatchGoogleAdsCodegen;
