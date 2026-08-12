import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RevealOnScrollDirective } from '../../../shared/reveal-on-scroll/reveal-on-scroll.directive';
import { ReclamacionesService, ReclamacionCreate } from '../../../services/reclamaciones';

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
  imports: [CommonModule, FormsModule, RevealOnScrollDirective],
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

  enviando = signal(false);
  enviado = signal(false);
  numeroCorrelativo = signal('');
  error = signal('');
  metodoContactoUsado = signal(''); // 'correo', 'telefono' o 'ambos'

  constructor(private reclamacionesService: ReclamacionesService) {}

  enviar(): void {
    if (!this.nombre || !this.numeroDocumento || !this.detalle) return;
    
    // Validación de contacto: al menos uno requerido
    if (!this.correo && !this.telefono) {
      this.error.set('Debes proporcionar al menos un correo o teléfono de contacto.');
      return;
    }

    this.error.set('');
    this.enviando.set(true);

    const data: ReclamacionCreate = {
      nombre: this.nombre,
      tipo_documento: this.tipoDocumento,
      numero_documento: this.numeroDocumento,
      correo: this.correo || null,
      telefono: this.telefono || null,
      domicilio: this.domicilio || null,
      tipo_bien: this.tipoBien,
      monto_reclamado: this.montoReclamado || null,
      descripcion_bien: this.descripcionBien || null,
      tipo: this.tipo,
      detalle: this.detalle,
      pedido: this.pedido || null,
    };

    this.reclamacionesService.registrar(data).subscribe({
      next: (res) => {
        this.numeroCorrelativo.set(res.numero_correlativo);
        this.enviando.set(false);
        this.enviado.set(true);
        if (this.correo && this.telefono) {
            this.metodoContactoUsado.set('ambos');
        } else if (this.correo) {
            this.metodoContactoUsado.set('correo');
        } else {
            this.metodoContactoUsado.set('telefono');
        }
      },
      error: (err) => {
        this.enviando.set(false);
        if (err.status === 422) {
          this.error.set('Revisa los datos ingresados. Falta información requerida.');
        } else {
          this.error.set('Ocurrió un error al enviar el reclamo. Por favor, intenta de nuevo.');
        }
      }
    });
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
    this.numeroCorrelativo.set('');
    this.error.set('');
  }
}
