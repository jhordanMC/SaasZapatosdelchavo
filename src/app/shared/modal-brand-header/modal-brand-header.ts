import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Header de marca reutilizable para modales: logo + nombre de marca con
 * acento de color (mismo formato que el modal "Ver perfil" del topbar) y
 * botón de cerrar circular. El título propio del modal va en `subtitle`.
 */
@Component({
  selector: 'app-modal-brand-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-brand-header.html',
  styleUrls: ['./modal-brand-header.css'],
})
export class ModalBrandHeaderComponent {
  @Input() subtitle = '';
  @Input() logoSrc = '/vilcas.png';
  @Input() brandName = 'VILCAS';
  @Input() brandAccentIndex = 4;
  @Output() cerrar = new EventEmitter<void>();
}
