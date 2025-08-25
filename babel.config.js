module.exports = {
  presets: [
    '@babel/preset-react',
    ['@babel/preset-typescript', { isTSX: true, allExtensions: true }]
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }]
  ]
}; 