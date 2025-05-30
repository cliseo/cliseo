import path from 'path';

const testSites = [
  {
    name: 'react-app',
    path: path.join('__fixtures__', 'react-app'),
    framework: 'react',
  },
  {
    name: 'next-app',
    path: path.join('__fixtures__', 'next-app'),
    framework: 'next',
  },
  {
    name: 'angular-app',
    path: path.join('__fixtures__', 'angular-app'),
    framework: 'angular',
  },
];

export default testSites; 