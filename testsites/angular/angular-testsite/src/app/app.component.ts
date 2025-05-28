import { Title, Meta } from "@angular/platform-browser";
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})export class

AppComponent implements OnInit {
  constructor(private titleService: Title, private metaService: Meta) {}
  title = 'angular-testsite';
  ngOnInit(): void {
    this.titleService.setTitle("Example Page");
    this.metaService.updateTag({ name: "description", content: "This is an example page for SEO." });
  }
}