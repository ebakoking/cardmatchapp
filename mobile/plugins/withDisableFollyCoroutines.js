const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to disable Folly coroutines
 * This fixes the 'folly/coro/Coroutine.h' file not found error
 * with react-native-reanimated 4.x on iOS
 */
const withDisableFollyCoroutines = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf-8');
        
        // Check if we already added our fix
        if (!podfileContent.includes('FOLLY_CFG_NO_COROUTINES')) {
          // Find the post_install block and add our fix
          const postInstallRegex = /(post_install do \|installer\|)/;
          
          if (postInstallRegex.test(podfileContent)) {
            // Add after the post_install opening
            const fixCode = `
    # Fix for folly/coro/Coroutine.h not found error
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_CFG_NO_COROUTINES=1'
      end
    end
`;
            podfileContent = podfileContent.replace(
              postInstallRegex,
              `$1${fixCode}`
            );
          } else {
            // Add a new post_install block at the end
            const fixCode = `
post_install do |installer|
  # Fix for folly/coro/Coroutine.h not found error
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_CFG_NO_COROUTINES=1'
    end
  end
end
`;
            podfileContent += fixCode;
          }
          
          fs.writeFileSync(podfilePath, podfileContent);
        }
      }
      
      return config;
    },
  ]);
};

module.exports = withDisableFollyCoroutines;
