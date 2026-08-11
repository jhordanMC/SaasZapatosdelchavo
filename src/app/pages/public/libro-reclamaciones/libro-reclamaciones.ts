import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RevealOnScrollDirective } from '../../../shared/reveal-on-scroll/reveal-on-scroll.directive';

/**
 * Libro de Reclamaciones Virtual — hoja de reclamación exigida por INDECOPI
 * (Ley N.º 29571, Código de Protección y Defensa del Consumidor / D.S. 101-2022-PCM)
 * para todo proveedor que atienda consumidores en el Perú.
 *
 * Solo maneja el estado del formulario en el front: TODO conectar el envío a un
 * endpoint real (ej. POST /api/reclamaciones) y a la correlativa/numeración
 * cuando el backend lo exponga.
 */
@Component({
  selector: 'app-libro-reclamaciones',
  standalone: true,
  imports: [FormsModule, RevealOnScrollDirective],
  templateUrl: './libro-reclamaciones.html',
  styleUrl: './libro-reclamaciones.css',
})
export class LibroReclamacionesComponent {
  // Identificación del consumidor
  nombre = '';
  tipoDocumento: 'DNI' | 'CE' | 'Pasaporte' = 'DNI';
  numeroDocumento = '';
  correo = '';
  telefono = '';
  domicilio = '';

  // Identificación del bien / servicio
  tipoBien: 'producto' | 'servicio' = 'servicio';
  montoReclamado = '';
  descripcionBien = '';

  // Detalle del reclamo
  tipo: 'reclamo' | 'queja' = 'reclamo';
  detalle = '';
  pedido = '';

  enviado = signal(false);
  numeroCorrelativo = signal('');

  enviar(): void {
    if (!this.nombre || !this.numeroDocumento || !this.correo || !this.detalle) return;
    // TODO: conectar a tu endpoint real cuando el backend lo exponga.
    const correlativo = `RC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    this.numeroCorrelativo.set(correlativo);
    this.enviado.set(true);
  }

  nuevoReclamo(): void {
    this.nombre = '';
    this.numeroDocumento = '';
    this.correo = '';
    this.telefono = '';
    this.domicilio = '';
    this.montoReclamado = '';
    this.descripcionBien = '';
    this.detalle = '';
    this.pedido = '';
    this.enviado.set(false);
  }
}
