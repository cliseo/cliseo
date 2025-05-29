import { TestSite } from '../core/types.js';
import path from 'path';

const testSites: TestSite[] = [
  {
    name: 'react-app',
    path: path.join('__fixtures__', 'react-app'),
    framework: 'react' as const,
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
    framework: 'next' as const,
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
    name: 'angular-app',
    path: path.join('__fixtures__', 'angular-app'),
    framework: 'angular' as const,
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
      },
      {
        type: 'img-alt',
        description: 'Images missing alt text',
        severity: 'high',
        location: {
          file: 'src/app/hero/hero.component.ts'
        }
      },
      {
        type: 'heading-structure',
        description: 'Invalid heading hierarchy',
        severity: 'medium',
        location: {
          file: 'src/app/about/about.component.ts'
        }
      }
    ]
  }
];

export default testSites; 