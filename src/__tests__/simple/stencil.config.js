exports.devServer = {
  additionalJsScripts: ['./alert.js', 'http://localhost:4444/red/blue.js'],
  watchGlob: '**/*.js',
  html5mode: true,
  root: __dirname,
};
