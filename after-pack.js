const path = require('path');
const { execSync } = require('child_process');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log('Applying deep ad-hoc code signature to:', appPath);
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
};
