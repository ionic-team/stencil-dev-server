var path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
exports.devServer = {
  additionalJsScripts: [path.join(__dirname, '/alert.js'), 'https://localhost:4444/red/blue.js'],
  watchGlob: '**/*.js',
  html5mode: true,
  root: __dirname,
  ssl : true
};
