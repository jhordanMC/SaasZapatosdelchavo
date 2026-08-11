/**
 * Componente de Catálogos Públicos (vista empresa, solo dueño).
 *
 * Conectado al backend a través de CatalogoService (/catalogos/*).
 *
 * Regla de negocio (refleja el backend): una empresa puede GUARDAR varios
 * catálogos (estado='borrador'), pero solo puede tener UNO 'publicado' a la
 * vez — publicar uno despublica automáticamente cualquier otro (lo hace el
 * backend en una sola transacción; acá solo se dispara el PATCH y se
 * refresca la lista).
 *
 * Flujos:
 *   - Init: GET /catalogos → lista completa de la empresa.
 *   - Crear: modal con nombre + color → POST /catalogos (nace en borrador).
 *   - Editar: mismo modal, precargado → PATCH /catalogos/{id}.
 *   - Publicar/Despublicar: PATCH estado.
 *   - Eliminar: confirm() → DELETE /catalogos/{id}.
 *   - Gestionar productos: modal picker → GET productos seleccionables,
 *     POST agregar (lote) + DELETE quitar (uno por uno) al guardar.
 */
import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  CatalogoCreateInput,
  CatalogoProductoRead,
  CatalogoRead,
  CatalogoService,
  CatalogoUpdateInput,
  EstadoCatalogo,
} from '../../../services/catalogo';

type TabCatalogo = 'mis-catalogos' | 'diseños-guardados' | 'preferencias';

/** Colores rápidos para el selector del formulario (no son "plantillas" reales del backend, solo atajos de color). */
const COLORES_SUGERIDOS = ['#0f2b23', '#1c1c1c', '#da9e0b', '#3a3a3a', '#f4c9c9', '#2b3a67'];

interface CatalogoForm {
  nombre: string;
  color_diseno: string;
}

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css',
})
export class CatalogoComponent implements OnInit {
  constructor(private catalogoService: CatalogoService) {}

  readonly tabs: { clave: TabCatalogo; label: string }[] = [
    { clave: 'mis-catalogos', label: 'Mis Catálogos' },
    { clave: 'diseños-guardados', label: 'Diseños Guardados' },
    { clave: 'preferencias', label: 'Preferencias' },
  ];
  readonly coloresSugeridos = COLORES_SUGERIDOS;

  tabActiva = signal<TabCatalogo>('mis-catalogos');
  busqueda = signal('');

  catalogos = signal<CatalogoRead[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  /** id del catálogo cuyo enlace acaba de copiarse (feedback momentáneo del botón). */
  enlaceCopiado = signal<string | null>(null);
  /** id del catálogo cuyo menú de acciones (⋮) está abierto. */
  menuAbierto = signal<string | null>(null);
  /** id del catálogo cuyo estado (publicar/despublicar) se está actualizando. */
  actualizandoEstado = signal<string | null>(null);
  /** id del catálogo que se está eliminando. */
  eliminando = signal<string | null>(null);

  // ── Modal crear/editar ────────────────────────────────────────────────
  modalFormAbierto = signal(false);
  catalogoEditando = signal<CatalogoRead | null>(null);
  form = signal<CatalogoForm>({ nombre: '', color_diseno: COLORES_SUGERIDOS[0] });
  guardandoForm = signal(false);
  errorForm = signal<string | null>(null);

  // ── Modal picker de productos ────────────────────────────────────────
  catalogoProductos = signal<CatalogoRead | null>(null);
  productosPicker = signal<CatalogoProductoRead[]>([]);
  seleccionPicker = signal<Set<string>>(new Set());
  seleccionOriginalPicker = new Set<string>();
  busquedaPicker = signal('');
  cargandoPicker = signal(false);
  guardandoPicker = signal(false);
  errorPicker = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.catalogoService.listarMios().subscribe({
      next: (catalogos) => {
        this.catalogos.set(catalogos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus catálogos. Verifica tu conexión.');
        this.cargando.set(false);
      },
    });
  }

  catalogosFiltrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    if (!termino) return this.catalogos();
    return this.catalogos().filter((c) => c.nombre.toLowerCase().includes(termino));
  });

  // ── KPIs del header (derivados de la lista real) ────────────────────────
  catalogosPublicados = computed(() => this.catalogos().filter((c) => c.estado === 'publicado').length);
  visitasTotales = computed(() => this.catalogos().reduce((suma, c) => suma + c.visitas, 0));
  productosMostrados = computed(() =>
    this.catalogos()
      .filter((c) => c.estado === 'publicado')
      .reduce((suma, c) => suma + c.productos_count, 0)
  );
  enlacesActivos = computed(() => this.catalogosPublicados());

  seleccionarTab(tab: TabCatalogo): void {
    this.tabActiva.set(tab);
  }

  onBusquedaChange(valor: string): void {
    this.busqueda.set(valor);
  }

  toggleMenu(id: string): void {
    this.menuAbierto.set(this.menuAbierto() === id ? null : id);
  }

  cerrarMenus(): void {
    this.menuAbierto.set(null);
  }

  estadoLabel(estado: EstadoCatalogo): string {
    return estado === 'publicado' ? 'Publicado' : 'Borrador';
  }

  formatearFecha(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  copiarEnlace(item: CatalogoRead): void {
    navigator.clipboard?.writeText(item.enlace).catch(() => {
      /* portapapeles no disponible (permiso/navegador) — se ignora en silencio */
    });
    this.enlaceCopiado.set(item.id_catalogo);
    setTimeout(() => {
      if (this.enlaceCopiado() === item.id_catalogo) this.enlaceCopiado.set(null);
    }, 1500);
  }

  verCatalogo(item: CatalogoRead): void {
    if (item.estado !== 'publicado') return;
    window.open(item.enlace.startsWith('http') ? item.enlace : `https://${item.enlace}`, '_blank');
  }

  // ── Publicar / despublicar ───────────────────────────────────────────

  publicar(item: CatalogoRead): void {
    this.menuAbierto.set(null);
    if (item.productos_count === 0) {
      this.error.set('Agrega al menos un producto antes de publicar este catálogo.');
      return;
    }
    this.actualizandoEstado.set(item.id_catalogo);
    this.catalogoService.publicar(item.id_catalogo).subscribe({
      next: () => {
        this.actualizandoEstado.set(null);
        this.cargar(); // refresca toda la lista: el que estaba publicado ahora es borrador
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'No se pudo publicar el catálogo.');
        this.actualizandoEstado.set(null);
      },
    });
  }

  despublicar(item: CatalogoRead): void {
    this.menuAbierto.set(null);
    this.actualizandoEstado.set(item.id_catalogo);
    this.catalogoService.despublicar(item.id_catalogo).subscribe({
      next: (actualizado) => {
        this.catalogos.set(this.catalogos().map((c) => (c.id_catalogo === actualizado.id_catalogo ? actualizado : c)));
        this.actualizandoEstado.set(null);
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'No se pudo despublicar el catálogo.');
        this.actualizandoEstado.set(null);
      },
    });
  }

  // ── Crear / editar ────────────────────────────────────────────────────

  abrirModalCrear(): void {
    this.catalogoEditando.set(null);
    this.form.set({ nombre: '', color_diseno: COLORES_SUGERIDOS[0] });
    this.errorForm.set(null);
    this.modalFormAbierto.set(true);
  }

  abrirModalEditar(item: CatalogoRead): void {
    this.menuAbierto.set(null);
    this.catalogoEditando.set(item);
    this.form.set({ nombre: item.nombre, color_diseno: item.color_diseno });
    this.errorForm.set(null);
    this.modalFormAbierto.set(true);
  }

  cerrarModalForm(): void {
    this.modalFormAbierto.set(false);
    this.catalogoEditando.set(null);
  }

  actualizarFormCampo<K extends keyof CatalogoForm>(campo: K, valor: CatalogoForm[K]): void {
    this.form.set({ ...this.form(), [campo]: valor });
  }

  guardarForm(): void {
    const datos = this.form();
    if (datos.nombre.trim().length < 2) {
      this.errorForm.set('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    this.guardandoForm.set(true);
    this.errorForm.set(null);

    const editando = this.catalogoEditando();
    if (editando) {
      const cambios: CatalogoUpdateInput = { nombre: datos.nombre.trim(), color_diseno: datos.color_diseno };
      this.catalogoService.actualizar(editando.id_catalogo, cambios).subscribe({
        next: (actualizado) => {
          this.catalogos.set(this.catalogos().map((c) => (c.id_catalogo === actualizado.id_catalogo ? actualizado : c)));
          this.guardandoForm.set(false);
          this.cerrarModalForm();
        },
        error: (err) => {
          this.errorForm.set(err?.error?.detail ?? 'No se pudo actualizar el catálogo.');
          this.guardandoForm.set(false);
        },
      });
    } else {
      const nuevo: CatalogoCreateInput = { nombre: datos.nombre.trim(), color_diseno: datos.color_diseno };
      this.catalogoService.crear(nuevo).subscribe({
        next: (creado) => {
          this.catalogos.set([creado, ...this.catalogos()]);
          this.guardandoForm.set(false);
          this.cerrarModalForm();
        },
        error: (err) => {
          this.errorForm.set(err?.error?.detail ?? 'No se pudo crear el catálogo.');
          this.guardandoForm.set(false);
        },
      });
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────────────

  eliminarCatalogo(item: CatalogoRead): void {
    this.menuAbierto.set(null);
    if (!confirm(`¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`)) return;
    this.eliminando.set(item.id_catalogo);
    this.catalogoService.eliminar(item.id_catalogo).subscribe({
      next: () => {
        this.catalogos.set(this.catalogos().filter((c) => c.id_catalogo !== item.id_catalogo));
        this.eliminando.set(null);
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'No se pudo eliminar el catálogo.');
        this.eliminando.set(null);
      },
    });
  }

  // ── Picker de productos ───────────────────────────────────────────────

  abrirGestionProductos(item: CatalogoRead): void {
    this.menuAbierto.set(null);
    this.catalogoProductos.set(item);
    this.busquedaPicker.set('');
    this.errorPicker.set(null);
    this.cargandoPicker.set(true);
    this.catalogoService.listarProductosSeleccionables(item.id_catalogo).subscribe({
      next: (productos) => {
        this.productosPicker.set(productos);
        const iniciales = new Set(productos.filter((p) => p.en_catalogo).map((p) => p.id_producto));
        this.seleccionOriginalPicker = new Set(iniciales);
        this.seleccionPicker.set(new Set(iniciales));
        this.cargandoPicker.set(false);
      },
      error: () => {
        this.errorPicker.set('No se pudieron cargar los productos de tu inventario.');
        this.cargandoPicker.set(false);
      },
    });
  }

  cerrarGestionProductos(): void {
    this.catalogoProductos.set(null);
    this.productosPicker.set([]);
    this.seleccionPicker.set(new Set());
    this.seleccionOriginalPicker = new Set();
  }

  productosPickerFiltrados = computed(() => {
    const termino = this.busquedaPicker().trim().toLowerCase();
    if (!termino) return this.productosPicker();
    return this.productosPicker().filter((p) => p.nombre.toLowerCase().includes(termino));
  });

  estaSeleccionadoPicker(idProducto: string): boolean {
    return this.seleccionPicker().has(idProducto);
  }

  toggleProductoPicker(idProducto: string): void {
    const nuevo = new Set(this.seleccionPicker());
    if (nuevo.has(idProducto)) nuevo.delete(idProducto);
    else nuevo.add(idProducto);
    this.seleccionPicker.set(nuevo);
  }

  guardarSeleccionPicker(): void {
    const catalogo = this.catalogoProductos();
    if (!catalogo) return;

    const actual = this.seleccionPicker();
    const original = this.seleccionOriginalPicker;
    const aAgregar = [...actual].filter((id) => !original.has(id));
    const aQuitar = [...original].filter((id) => !actual.has(id));

    if (aAgregar.length === 0 && aQuitar.length === 0) {
      this.cerrarGestionProductos();
      return;
    }

    this.guardandoPicker.set(true);
    this.errorPicker.set(null);

    const peticiones = [
      aAgregar.length > 0
        ? this.catalogoService.agregarProductos(catalogo.id_catalogo, aAgregar)
        : of(null),
      ...aQuitar.map((id) =>
        this.catalogoService.quitarProducto(catalogo.id_catalogo, id).pipe(catchError(() => of(null)))
      ),
    ];

    forkJoin(peticiones).subscribe({
      next: () => {
        this.guardandoPicker.set(false);
        // Refresca productos_count del catálogo en la lista sin recargar todo.
        const nuevoCount = catalogo.productos_count + aAgregar.length - aQuitar.length;
        this.catalogos.set(
          this.catalogos().map((c) =>
            c.id_catalogo === catalogo.id_catalogo ? { ...c, productos_count: Math.max(0, nuevoCount) } : c
          )
        );
        this.cerrarGestionProductos();
      },
      error: () => {
        this.errorPicker.set('No se pudieron guardar los cambios. Intenta de nuevo.');
        this.guardandoPicker.set(false);
      },
    });
  }
}