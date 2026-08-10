import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RevealOnScrollDirective } from '../../../shared/reveal-on-scroll/reveal-on-scroll.directive';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [FormsModule, RevealOnScrollDirective],
  templateUrl: './contacto.html',
  styleUrl: './contacto.css',
})
export class ContactoComponent {
  nombre = '';
  correo = '';
  mensaje = '';
  enviado = signal(false);

  enviar(): void {
    if (!this.nombre || !this.correo || !this.mensaje) return;
    // TODO: conectar a tu endpoint real (ej. POST /api/contacto) cuando el backend lo exponga.
    this.enviado.set(true);
  }
}