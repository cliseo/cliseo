import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app">
      <!-- Intentionally not using Title service for dynamic titles -->
      <app-hero></app-hero>
      <app-about></app-about>
    </div>
  `,
  styles: []
})
export class AppComponent {
  // Missing title service injection and configuration
} 