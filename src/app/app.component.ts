import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdleService } from './shared/components/inactividad/idle.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'agrOredFront';
  constructor(private idleService: IdleService) {
  }
}
