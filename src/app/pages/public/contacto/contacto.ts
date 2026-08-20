import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RevealOnScrollDirective } from '../../../shared/reveal-on-scroll/reveal-on-scroll.directive';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [FormsModule, RouterLink, RevealOnScrollDirective],
  templateUrl: './contacto.html',
  styleUrl: './contacto.css',
})
export class ContactoComponent {
  nombre = '';
  correo = '';
  mensaje = '';
  enviado = signal(false);

  // FAQ desplegable (el primer elemento abierto por defecto)
  faqAbierto = signal<number | null>(1);

  toggleFaq(id: number): void {
    if (this.faqAbierto() === id) {
      this.faqAbierto.set(null);
    } else {
      this.faqAbierto.set(id);
    }
  }

  enviar(): void {
    if (!this.nombre || !this.correo || !this.mensaje) return;
    this.enviado.set(true);
  }
}