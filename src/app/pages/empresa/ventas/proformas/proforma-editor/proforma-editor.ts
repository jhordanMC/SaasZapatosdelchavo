/**
 * Creación / edición de proformas — módulo Ventas.
 *
 * Reutiliza el mismo catálogo del POS (VentasService.listarProductosPOS)
 * para buscar productos con precio y foto, pero a diferencia del POS:
 *   - No descuenta stock ni pide sede/caja (es solo una cotización).
 *   - El precio y la talla son editables por línea (para poder ajustar
 *     una oferta al cliente sin tocar el precio real del catálogo).
 *
 * Ruta sin id (`ventas/proformas/nueva`) = creación.
 * Ruta con id (`ventas/proformas/:id`)   = edición de una proforma existente.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environment';
import { AuthService } from '../../../../../core/auth';
import { ModalBrandHeaderComponent } from '../../../../../shared/modal-brand-header/modal-brand-header';
import { FiltrosPOS, ProductoPOSRead, ProductosPOSPaginados, VentasService } from '../../../../../services/ventas';
import { ClienteProforma, ItemProforma, Proforma, ProformasService } from '../../../../../services/proformas';
import { exportarProformaPDFConImagenes, exportarProformaPDFSinImagenes } from '../../../../../utils/exportar-proforma';

function hoyISO(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

type PasoEditor = 'formulario' | 'guardada';

@Component({
  selector: 'app-proforma-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalBrandHeaderComponent],
  templateUrl: './proforma-editor.html',
  styleUrls: ['./proforma-editor.css'],
})
export class ProformaEditorComponent implements OnInit {
  constructor(
    private ventasService: VentasService,
    private proformasService: ProformasService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.busquedaSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.cargarPrimeraPaginaCatalogo();
    });
  }

  // ── Modo edición vs. creación ────────────────────────────────────────────
  idProforma: string | null = null;
  get modoEdicion(): boolean {
    return !!this.idProforma;
  }

  paso: PasoEditor = 'formulario';
  proformaGuardada: Proforma | null = null;

  // ── Datos del cliente y de la cotización ─────────────────────────────────
  cliente: ClienteProforma = { nombre: '', telefono: '', correo: '', direccion: '' };
  notas = '';
  fechaEmision = hoyISO();
  validoHastaDias = 7;
  descuentoGlobal = 0;

  items = signal<ItemProforma[]>([]);

  errorGuardar = signal<string | null>(null);
  guardando = signal(false);

  // ── Catálogo (búsqueda + scroll infinito, igual criterio que el POS) ─────
  productos = signal<ProductoPOSRead[]>([]);
  cargandoCatalogo = signal(true);
  cargandoMasCatalogo = signal(false);
  hayMasCatalogo = signal(true);
  private offsetCatalogo = 0;
  private readonly busquedaSubject = new Subject<string>();
  busquedaCatalogo = '';

  // ── Panel de "agregar producto" ──────────────────────────────────────────
  productoSeleccionado: ProductoPOSRead | null = null;
  tallaNueva = '';
  cantidadNueva = 1;
  precioNuevo = 0;
  descuentoNuevo = 0;

  // ── Impresión tras guardar ────────────────────────────────────────────────
  generandoPdf = signal(false);

  ngOnInit(): void {
    this.idProforma = this.route.snapshot.paramMap.get('id');
    if (this.idProforma) {
      const existente = this.proformasService.obtener(this.idProforma);
      if (existente) {
        this.cliente = { ...existente.cliente };
        this.notas = existente.notas;
        this.fechaEmision = existente.fechaEmision;
        this.validoHastaDias = existente.validoHastaDias;
        this.descuentoGlobal = existente.descuentoGlobal;
        this.items.set(existente.items.map((i) => ({ ...i })));
      } else {
        this.errorGuardar.set('No se encontró esa proforma. Puede que ya haya sido eliminada.');
      }
    }
    this.cargarPrimeraPaginaCatalogo();
  }

  // ── Catálogo ──────────────────────────────────────────────────────────────

  imagenSrc(imagenUrl: string | null): string | null {
    return imagenUrl ? `${environment.apiUrl}${imagenUrl}` : null;
  }

  onBusquedaCatalogoChange(valor: string): void {
    this.busquedaCatalogo = valor;
    this.busquedaSubject.next(valor);
  }

  cargarPrimeraPaginaCatalogo(): void {
    this.offsetCatalogo = 0;
    this.productos.set([]);
    this.hayMasCatalogo.set(true);
    this.cargarPaginaCatalogo();
  }

  cargarMasCatalogo(): void {
    if (this.cargandoMasCatalogo() || !this.hayMasCatalogo()) return;
    this.cargarPaginaCatalogo();
  }

  private cargarPaginaCatalogo(): void {
    if (!this.hayMasCatalogo()) return;
    const esPrimeraPagina = this.offsetCatalogo === 0;
    esPrimeraPagina ? this.cargandoCatalogo.set(true) : this.cargandoMasCatalogo.set(true);

    const filtros: FiltrosPOS = {};
    if (this.busquedaCatalogo) filtros.busqueda = this.busquedaCatalogo;

    this.ventasService.listarProductosPOS(null, filtros, this.offsetCatalogo).subscribe({
      next: (resp: ProductosPOSPaginados) => {
        this.productos.update((lista) => [...lista, ...resp.items]);
        this.hayMasCatalogo.set(resp.hay_mas);
        this.offsetCatalogo = resp.siguiente_offset;
        this.cargandoCatalogo.set(false);
        this.cargandoMasCatalogo.set(false);
      },
      error: () => {
        this.cargandoCatalogo.set(false);
        this.cargandoMasCatalogo.set(false);
      },
    });
  }

  // ── Agregar producto a la cotización ─────────────────────────────────────

  abrirAgregarProducto(p: ProductoPOSRead): void {
    this.productoSeleccionado = p;
    this.tallaNueva = '';
    this.cantidadNueva = 1;
    this.precioNuevo = p.precio_venta;
    this.descuentoNuevo = 0;
  }

  cerrarAgregarProducto(): void {
    this.productoSeleccionado = null;
  }

  confirmarAgregarProducto(): void {
    const p = this.productoSeleccionado;
    if (!p) return;
    if (this.cantidadNueva < 1) return;

    const nuevoItem: ItemProforma = {
      id: crypto.randomUUID(),
      productoId: p.id_producto,
      nombre: p.nombre,
      talla: this.tallaNueva.trim() || null,
      sku: null,
      imagenUrl: p.imagen_url,
      precioUnitario: Number(this.precioNuevo) || 0,
      cantidad: Number(this.cantidadNueva) || 1,
      descuentoMonto: Number(this.descuentoNuevo) || 0,
    };
    this.items.update((lista) => [...lista, nuevoItem]);
    this.productoSeleccionado = null;
  }

  quitarItem(id: string): void {
    this.items.update((lista) => lista.filter((i) => i.id !== id));
  }

  totalItem(item: ItemProforma): number {
    return this.proformasService.totalItem(item);
  }

  get subtotal(): number {
    return this.proformasService.subtotal({ items: this.items() });
  }

  get total(): number {
    return this.proformasService.total({ items: this.items(), descuentoGlobal: this.descuentoGlobal });
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  guardar(): void {
    this.errorGuardar.set(null);

    if (!this.cliente.nombre.trim()) {
      this.errorGuardar.set('Ingresa el nombre del cliente.');
      return;
    }
    if (this.items().length === 0) {
      this.errorGuardar.set('Agrega al menos un producto a la cotización.');
      return;
    }

    this.guardando.set(true);

    const data = {
      cliente: { ...this.cliente },
      items: this.items(),
      descuentoGlobal: Number(this.descuentoGlobal) || 0,
      notas: this.notas,
      fechaEmision: this.fechaEmision,
      validoHastaDias: Number(this.validoHastaDias) || 0,
    };

    if (this.modoEdicion && this.idProforma) {
      this.proformasService.actualizar(this.idProforma, data);
      this.proformaGuardada = this.proformasService.obtener(this.idProforma) ?? null;
    } else {
      const nueva = this.proformasService.crear(data);
      this.idProforma = nueva.id;
      this.proformaGuardada = nueva;
    }

    this.guardando.set(false);
    this.paso = 'guardada';
  }

  seguirEditando(): void {
    this.paso = 'formulario';
  }

  volverAlListado(): void {
    this.router.navigate(['/empresa/ventas/proformas']);
  }

  // ── Impresión (disponible apenas se guarda) ──────────────────────────────

  private nombreEmpresa(): string {
    return this.authService.usuarioActual()?.nombreEmpresa ?? 'Cotización';
  }

  imprimirSinImagenes(): void {
    if (!this.proformaGuardada) return;
    exportarProformaPDFSinImagenes(this.proformaGuardada, this.nombreEmpresa());
  }

  async imprimirConImagenes(): Promise<void> {
    if (!this.proformaGuardada || this.generandoPdf()) return;
    this.generandoPdf.set(true);
    try {
      await exportarProformaPDFConImagenes(this.proformaGuardada, this.nombreEmpresa());
    } finally {
      this.generandoPdf.set(false);
    }
  }
}
