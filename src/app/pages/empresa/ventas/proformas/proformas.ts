/**
 * Listado de proformas (cotizaciones) — módulo Ventas.
 *
 * Todo vive en el navegador (ver ProformasService): no hay paginación de
 * servidor porque no hay servidor. Con el volumen esperado de cotizaciones
 * de una tienda de zapatos esto es más que suficiente; si algún día crece
 * mucho, este es el componente a migrar cuando exista el backend.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalBrandHeaderComponent } from '../../../../shared/modal-brand-header/modal-brand-header';
import { AuthService } from '../../../../core/auth';
import { EstadoProforma, Proforma, ProformasService } from '../../../../services/proformas';
import { exportarProformaPDFConImagenes, exportarProformaPDFSinImagenes } from '../../../../utils/exportar-proforma';

@Component({
  selector: 'app-proformas',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalBrandHeaderComponent],
  templateUrl: './proformas.html',
  styleUrls: ['./proformas.css'],
})
export class ProformasComponent implements OnInit {
  constructor(
    private proformasService: ProformasService,
    private authService: AuthService,
    private router: Router
  ) {}

  todas = signal<Proforma[]>([]);
  busqueda = '';
  filtroEstado: EstadoProforma | '' = '';

  /** id de la proforma cuyo PDF se está generando ahora mismo (deshabilita sus botones). */
  generando = signal<string | null>(null);

  proformaAEliminar = signal<Proforma | null>(null);
  eliminando = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.todas.set(this.proformasService.listar());
  }

  get proformasFiltradas(): Proforma[] {
    const texto = this.busqueda.trim().toLowerCase();
    return this.todas().filter((p) => {
      const coincideTexto =
        !texto ||
        p.numero.toLowerCase().includes(texto) ||
        p.cliente.nombre.toLowerCase().includes(texto);
      const coincideEstado = !this.filtroEstado || this.proformasService.estado(p) === this.filtroEstado;
      return coincideTexto && coincideEstado;
    });
  }

  estado(p: Proforma): EstadoProforma {
    return this.proformasService.estado(p);
  }

  vencimiento(p: Proforma): string {
    return this.proformasService.fechaVencimiento(p);
  }

  total(p: Proforma): number {
    return this.proformasService.total(p);
  }

  nuevaProforma(): void {
    this.router.navigate(['/empresa/ventas/proformas/nueva']);
  }

  editar(p: Proforma): void {
    this.router.navigate(['/empresa/ventas/proformas', p.id]);
  }

  // ── Impresión ────────────────────────────────────────────────────────────

  private nombreEmpresa(): string {
    return this.authService.usuarioActual()?.nombreEmpresa ?? 'Cotización';
  }

  imprimirSinImagenes(p: Proforma): void {
    if (this.generando()) return;
    exportarProformaPDFSinImagenes(p, this.nombreEmpresa());
  }

  async imprimirConImagenes(p: Proforma): Promise<void> {
    if (this.generando()) return;
    this.generando.set(p.id);
    try {
      await exportarProformaPDFConImagenes(p, this.nombreEmpresa());
    } finally {
      this.generando.set(null);
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────

  abrirEliminar(p: Proforma): void {
    this.proformaAEliminar.set(p);
  }

  cerrarEliminar(): void {
    if (this.eliminando()) return;
    this.proformaAEliminar.set(null);
  }

  confirmarEliminar(): void {
    const p = this.proformaAEliminar();
    if (!p) return;
    this.eliminando.set(true);
    this.proformasService.eliminar(p.id);
    this.eliminando.set(false);
    this.proformaAEliminar.set(null);
    this.cargar();
  }
}
