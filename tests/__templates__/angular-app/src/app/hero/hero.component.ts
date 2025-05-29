import { Component } from '@angular/core';

@Component({
  selector: 'app-hero',
  template: `
    <div class="hero">
      <div class="hero-content">
        <h1>Welcome to Our Angular Site</h1>
        <p>Discover amazing things with us</p>
      </div>
      <!-- Intentionally missing alt text -->
      <img src="/assets/images/hero-banner.jpg" class="hero-image">
      <div class="hero-features">
        <div class="feature">
          <!-- Intentionally missing alt text -->
          <img src="/assets/images/feature1.png" class="feature-icon">
          <h3>Feature 1</h3>
        </div>
        <div class="feature">
          <!-- Intentionally missing alt text -->
          <img src="/assets/images/feature2.png" class="feature-icon">
          <h3>Feature 2</h3>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class HeroComponent {} 