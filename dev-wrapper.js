const { exec } = require('child_process');
const path = require('path');
const nextPath = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
exec('node "' + nextPath + '" dev', { cwd: __dirname, stdio: 'inherit' });
