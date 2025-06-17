module.exports = {
  presets: [
    '@babel/preset-react',
    '@babel/preset-typescript'
  ],
  plugins: [
    '@babel/plugin-syntax-jsx',
    ['@babel/plugin-syntax-typescript', { isTSX: true, allExtensions: true }],
    '@babel/plugin-transform-react-jsx',
    '@babel/plugin-transform-typescript'
  ]
}; 