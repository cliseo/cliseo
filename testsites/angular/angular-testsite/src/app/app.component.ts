import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})export class

AppComponent implements OnInit {
  constructor() {}
  title = 'angular-testsite';
  ngOnInit(): void {

  }
}