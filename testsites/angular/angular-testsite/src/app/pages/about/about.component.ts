import { NgOptimizedImage } from "@angular/common";
import { Title, Meta } from "@angular/platform-browser";
import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})export class
AboutComponent {}