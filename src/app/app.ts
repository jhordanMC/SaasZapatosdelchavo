import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionExpiredModalComponent } from './shared/session-expired-modal/session-expired-modal';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SessionExpiredModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ProyectoSaasAlba');
}
