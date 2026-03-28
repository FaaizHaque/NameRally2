/**
 * Expo config plugin — injects a Ruby patch into the generated Podfile
 * that fixes react-native-google-mobile-ads spec files before codegen runs.
 *
 * The patch replaces Promise<void> with Promise<null> in the TypeScript
 * NativeModule specs. React Native 0.79 strict codegen rejects void as a
 * generic type parameter ("Unrecognized generic type 'undefined'").
 *
 * Why Podfile injection instead of patching node_modules directly:
 *   - EAS caches node_modules — postinstall and withDangerousMod patches to
 *     node_modules are wiped on cache restore.
 *   - codegen runs INSIDE use_react_native! (called from the Podfile), so
 *     patching the files inline in the Podfile — just before that call —
 *     is the earliest reliable hook in the EAS managed build chain.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '# [NameRally] patch-google-ads-codegen';

const PATCH_RUBY = `
${PATCH_MARKER}
# Fix react-native-google-mobile-ads NativeModule specs for RN 0.79 codegen.
# 1. Promise<void> -> Promise<null>  (void treated as undefined in generics)
# 2. CodegenTypes.UnsafeObject -> Object  (namespace unresolved -> undefined)
Dir.glob(File.join(File.dirname(__FILE__), '..', 'node_modules',
    'react-native-google-mobile-ads', 'src', 'specs', 'modules', '*.ts')).each do |f|
  content = File.read(f)
  content.gsub!('Promise<void>', 'Promise<null>')
  content.gsub!('CodegenTypes.UnsafeObject', 'Object')
  content.gsub!(/import type \\{ CodegenTypes \\} from 'react-native';\\n?/, '')
  File.write(f, content)
  puts "[patch-google-ads-codegen] patched \#{File.basename(f)}"
end
`;

const withPatchGoogleAdsCodegen = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.warn('[withPatchGoogleAdsCodegen] Podfile not found, skipping');
        return config;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Idempotent — don't add twice
      if (contents.includes(PATCH_MARKER)) {
        return config;
      }

      // Inject patch just before use_react_native! so it runs before codegen
      if (!contents.includes('use_react_native!(')) {
        console.warn('[withPatchGoogleAdsCodegen] use_react_native! not found in Podfile');
        return config;
      }

      contents = contents.replace('use_react_native!(', PATCH_RUBY + '\nuse_react_native!(');
      fs.writeFileSync(podfilePath, contents);
      console.log('[withPatchGoogleAdsCodegen] injected patch into Podfile');

      return config;
    },
  ]);
};

module.exports = withPatchGoogleAdsCodegen;
