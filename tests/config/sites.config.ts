import { TestSite } from '../core/types.js';
import path from 'path';

const testSites: TestSite[] = [
  {
    name: 'react-app',
    path: path.join('__fixtures__', 'react-app'),
    framework: 'react' as const,
    expectedIssues: [
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
    ],
    criticalPages: [
      '/',
      '/about',
      '/products'
    ],
    criticalSelectors: [
      // Navigation
      'nav',
      'a[href="/about"]',
      'a[href="/products"]',
      // Main content sections
      '#root',
      '.hero-section',
      '.about-section',
      '.products-section',
      // Interactive elements
      'button[type="submit"]',
      '.product-card',
      // Footer
      'footer'
    ]
  },
  {
    name: 'next-app',
    path: path.join('__fixtures__', 'next-app'),
    framework: 'next' as const,
    expectedIssues: [
      {
        type: 'meta-description',
        description: 'Missing meta description tag',
        severity: 'high',
        location: {
          file: 'src/app/layout.tsx'
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
    ],
    criticalPages: [
      '/',
      '/about',
      '/products',
      '/blog'  // Next.js specific route
    ],
    criticalSelectors: [
      // App shell
      '#__next',
      'header',
      // Navigation
      'nav',
      'a[href="/about"]',
      'a[href="/products"]',
      'a[href="/blog"]',
      // Main content
      'main',
      '.hero-section',
      '.about-content',
      '.products-grid',
      // Dynamic elements
      '[data-testid="product-card"]',
      // Footer
      'footer'
    ]
  }
];

export default testSites; 