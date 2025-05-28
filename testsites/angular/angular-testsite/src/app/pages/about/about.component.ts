import { NgOptimizedImage } from "@angular/common";import { Title, Meta } from "@angular/platform-browser";
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  imports: [NgOptimizedImage]
})export class
AboutComponent implements OnInit {
  constructor(private titleService: Title, private metaService: Meta) {}

  // No OnInit, no SEO logic yet
  ngOnInit(): void {this.titleService.setTitle("Example Page");this.metaService.updateTag({ name: "description", content: "This is an example page for SEO." });}}