import { TestSite } from '../core/types';
import path from 'path';

const testSites: TestSite[] = [
  {
    name: 'basic-react',
    path: path.join('__fixtures__', 'react-app'),
    framework: 'react',
    expectedIssues: [
      {
        type: 'meta-description',
        description: 'Missing meta description tag',
        severity: 'high',
        location: {
          file: 'public/index.html',
          line: 9
        }
      },
      {
        type: 'img-alt',
        description: 'Images missing alt text',
        severity: 'high',
        location: {
          file: 'src/components/Hero.tsx'
        }
      },
      {
        type: 'heading-structure',
        description: 'Invalid heading hierarchy',
        severity: 'medium',
        location: {
          file: 'src/components/About.tsx'
        }
      }
    ]
  },
  {
    name: 'next-app',
    path: path.join('__fixtures__', 'next-app'),
    framework: 'next',
    expectedIssues: [
      {
        type: 'meta-tags',
        description: 'Missing OpenGraph tags',
        severity: 'high',
        location: {
          file: 'src/app/layout.tsx'
        }
      },
      {
        type: 'robots',
        description: 'Missing robots.txt configuration',
        severity: 'medium'
      },
      {
        type: 'sitemap',
        description: 'Missing sitemap.xml',
        severity: 'medium'
      }
    ]
  },
  {
    name: 'vue-app',
    path: path.join('__fixtures__', 'vue-app'),
    framework: 'vue',
    expectedIssues: [
      {
        type: 'meta-viewport',
        description: 'Missing viewport meta tag',
        severity: 'high',
        location: {
          file: 'index.html'
        }
      },
      {
        type: 'schema-markup',
        description: 'Missing schema.org markup',
        severity: 'medium',
        location: {
          file: 'src/components/ProductList.vue'
        }
      }
    ]
  },
  {
    name: 'angular-app',
    path: path.join('__fixtures__', 'angular-app'),
    framework: 'angular',
    expectedIssues: [
      {
        type: 'meta-title',
        description: 'Dynamic title not set correctly',
        severity: 'high',
        location: {
          file: 'src/app/app.component.ts'
        }
      },
      {
        type: 'canonical-url',
        description: 'Missing canonical URL tags',
        severity: 'medium',
        location: {
          file: 'src/index.html'
        }
      }
    ]
  }
];

export default testSites; 