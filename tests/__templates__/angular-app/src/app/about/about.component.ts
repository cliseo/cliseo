import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  template: `
    <div class="about">
      <!-- Invalid heading hierarchy - skipping h1 -->
      <h2>About Our Company</h2>
      
      <div class="mission">
        <!-- Invalid - h3 after h2 without parent h2 -->
        <h3>Our Mission</h3>
        <p>We strive to provide the best experience for our users.</p>
      </div>

      <div class="values">
        <!-- Invalid - h4 after h3 without parent h3 -->
        <h4>Core Values</h4>
        <ul>
          <li>Innovation</li>
          <li>Quality</li>
          <li>Customer Focus</li>
        </ul>
      </div>

      <div class="team">
        <!-- Invalid - jumping back to h2 -->
        <h2>Our Team</h2>
        <p>Meet the amazing people behind our success.</p>
      </div>
    </div>
  `,
  styles: []
})
export class AboutComponent {} 