import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <main>
      <!-- Missing title tag -->
      <h1>Welcome to Our Angular App</h1>
      <!-- Missing meta description -->
      <p>This is a test app for SEO optimization.</p>
      <!-- Missing alt text -->
      <img src="/logo.png" />
      <!-- Missing semantic HTML -->
      <div>Important content here</div>
      <!-- Missing structured data -->
      <div>Product: Test Product</div>
      <div>Price: $99.99</div>
    </main>
  `,
  styles: []
})
export class AppComponent {
  title = 'angular-app-test';
} 