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
import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
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
  subtitulo: string;
  whatsapp_numero: string;
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
  /** Posición (fixed, en viewport) del menú abierto — calculada en toggleMenu() a partir
   * del botón que lo disparó, así el menú escapa del scroll horizontal de .tabla-wrap en
   * vez de quedar recortado/tapado por su overflow. */
  menuPos = signal<{ top: number; left: number } | null>(null);
  /** id del catálogo cuyo estado (publicar/despublicar) se está actualizando. */
  actualizandoEstado = signal<string | null>(null);
  /** id del catálogo que se está eliminando. */
  eliminando = signal<string | null>(null);

  // ── Modal crear/editar ────────────────────────────────────────────────
  modalFormAbierto = signal(false);
  catalogoEditando = signal<CatalogoRead | null>(null);
  form = signal<CatalogoForm>({ nombre: '', color_diseno: COLORES_SUGERIDOS[0], subtitulo: '', whatsapp_numero: '' });
  guardandoForm = signal(false);
  errorForm = signal<string | null>(null);

  // ── Portada (solo disponible editando, no en la creación: necesita id_catalogo) ──
  archivoPortada: File | null = null;
  previsualizacionPortada = signal<string | null>(null);
  subiendoPortada = signal(false);

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

  private static readonly ANCHO_MENU = 180;

  toggleMenu(id: string, evento: MouseEvent): void {
    if (this.menuAbierto() === id) {
      this.menuAbierto.set(null);
      this.menuPos.set(null);
      return;
    }
    const boton = evento.currentTarget as HTMLElement;
    const rect = boton.getBoundingClientRect();
    const ancho = CatalogoComponent.ANCHO_MENU;
    // Alineado a la derecha del botón, pero sin salirse de la ventana (clave en mobile).
    const left = Math.min(Math.max(8, rect.right - ancho), window.innerWidth - ancho - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    this.menuPos.set({ top, left });
    this.menuAbierto.set(id);
  }

  cerrarMenus(): void {
    this.menuAbierto.set(null);
    this.menuPos.set(null);
  }

  /** El menú es `position: fixed` (viewport), no relativo a la fila — si el usuario
   * scrollea la lista mientras está abierto, se desalinearía del botón; más simple
   * cerrarlo que reposicionarlo en cada scroll. */
  @HostListener('scroll')
  onScrollHost(): void {
    if (this.menuAbierto()) this.cerrarMenus();
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

  // ── Compartir (redes) ────────────────────────────────────────────────
  // Solo arman la URL de share estándar de cada red con el enlace público
  // del catálogo — no hay nada que llamar en el backend para esto.

  private enlaceAbsoluto(item: CatalogoRead): string {
    return item.enlace.startsWith('http') ? item.enlace : `https://${item.enlace}`;
  }

  compartirWhatsApp(item: CatalogoRead): void {
    const texto = encodeURIComponent(`Mira mi catálogo "${item.nombre}": ${this.enlaceAbsoluto(item)}`);
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  }

  compartirFacebook(item: CatalogoRead): void {
    const url = encodeURIComponent(this.enlaceAbsoluto(item));
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  }

  compartirEmail(item: CatalogoRead): void {
    const asunto = encodeURIComponent(`Catálogo: ${item.nombre}`);
    const cuerpo = encodeURIComponent(`Te comparto mi catálogo "${item.nombre}": ${this.enlaceAbsoluto(item)}`);
    window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
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
    this.form.set({ nombre: '', color_diseno: COLORES_SUGERIDOS[0], subtitulo: '', whatsapp_numero: '' });
    this.errorForm.set(null);
    this.resetPortadaForm();
    this.modalFormAbierto.set(true);
  }

  /** Igual que abrirModalCrear() pero con un color precargado — usado por
   *  la tira de inicio rápido del panel lateral (mismos colores sugeridos
   *  del formulario, solo que elegirlo ahí ya abre el modal listo). */
  abrirModalCrearConColor(color: string): void {
    this.catalogoEditando.set(null);
    this.form.set({ nombre: '', color_diseno: color, subtitulo: '', whatsapp_numero: '' });
    this.errorForm.set(null);
    this.resetPortadaForm();
    this.modalFormAbierto.set(true);
  }

  abrirModalEditar(item: CatalogoRead): void {
    this.menuAbierto.set(null);
    this.catalogoEditando.set(item);
    this.form.set({
      nombre: item.nombre,
      color_diseno: item.color_diseno,
      subtitulo: item.subtitulo ?? '',
      whatsapp_numero: item.whatsapp_numero ?? '',
    });
    this.errorForm.set(null);
    this.resetPortadaForm();
    this.modalFormAbierto.set(true);
  }

  cerrarModalForm(): void {
    this.modalFormAbierto.set(false);
    this.catalogoEditando.set(null);
    this.resetPortadaForm();
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
      const cambios: CatalogoUpdateInput = {
        nombre: datos.nombre.trim(),
        color_diseno: datos.color_diseno,
        subtitulo: datos.subtitulo.trim(),
        whatsapp_numero: datos.whatsapp_numero.trim(),
      };
      this.catalogoService.actualizar(editando.id_catalogo, cambios).subscribe({
        next: (actualizado) => this.despuesDeGuardarForm(actualizado),
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
          // subtitulo/whatsapp_numero no van en CatalogoCreate (el backend solo
          // acepta nombre + color al crear) — si el usuario ya los llenó, se
          // completan con un PATCH inmediato después de crear.
          const extra: CatalogoUpdateInput = {
            subtitulo: datos.subtitulo.trim(),
            whatsapp_numero: datos.whatsapp_numero.trim(),
          };
          if (extra.subtitulo || extra.whatsapp_numero) {
            this.catalogoService.actualizar(creado.id_catalogo, extra).subscribe({
              next: (actualizado) => this.despuesDeGuardarForm(actualizado),
              error: () => this.despuesDeGuardarForm(creado), // el catálogo ya se creó; el extra puede completarse después editando
            });
          } else {
            this.despuesDeGuardarForm(creado);
          }
        },
        error: (err) => {
          this.errorForm.set(err?.error?.detail ?? 'No se pudo crear el catálogo.');
          this.guardandoForm.set(false);
        },
      });
    }
  }

  /** Común a crear y editar: refresca la fila en la tabla y, si hay una portada
   * elegida en el form, la sube antes de cerrar el modal. */
  private despuesDeGuardarForm(catalogo: CatalogoRead): void {
    this.catalogos.set(this.catalogos().map((c) => (c.id_catalogo === catalogo.id_catalogo ? catalogo : c)));
    if (!this.catalogos().some((c) => c.id_catalogo === catalogo.id_catalogo)) {
      this.catalogos.set([catalogo, ...this.catalogos()]);
    }
    if (!this.archivoPortada) {
      this.guardandoForm.set(false);
      this.cerrarModalForm();
      return;
    }
    this.subiendoPortada.set(true);
    this.catalogoService.subirPortada(catalogo.id_catalogo, this.archivoPortada).subscribe({
      next: (conPortada) => {
        this.catalogos.set(this.catalogos().map((c) => (c.id_catalogo === conPortada.id_catalogo ? conPortada : c)));
        this.subiendoPortada.set(false);
        this.guardandoForm.set(false);
        this.cerrarModalForm();
      },
      error: (err) => {
        // El catálogo (nombre/color/etc) ya se guardó bien; solo falló la portada.
        this.errorForm.set(err?.error?.detail ?? 'El catálogo se guardó, pero la portada no se pudo subir. Intenta subirla de nuevo.');
        this.subiendoPortada.set(false);
        this.guardandoForm.set(false);
      },
    });
  }

  // ── Portada ───────────────────────────────────────────────────────────

  private resetPortadaForm(): void {
    this.archivoPortada = null;
    this.previsualizacionPortada.set(null);
    this.subiendoPortada.set(false);
  }

  onPortadaSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    if (!archivo) return;
    this.archivoPortada = archivo;
    const lector = new FileReader();
    lector.onload = () => this.previsualizacionPortada.set(lector.result as string);
    lector.readAsDataURL(archivo);
  }

  quitarPortadaSeleccionada(): void {
    this.archivoPortada = null;
    this.previsualizacionPortada.set(null);
  }

  /** Portada ya guardada del catálogo en edición (antes de elegir una nueva). */
  portadaActualSrc(): string | null {
    const item = this.catalogoEditando();
    if (!item?.imagen_portada_url) return null;
    return this.imagenSrc(item.imagen_portada_url);
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

  /** Arma la URL absoluta de una foto de producto (imagen_url del backend guarda solo la ruta relativa, ej. /uploads/...). */
  imagenSrc(imagenUrl: string | null): string | null {
    if (!imagenUrl) return null;
    return imagenUrl.startsWith('data:') || imagenUrl.startsWith('http')
      ? imagenUrl
      : `${environment.apiUrl}${imagenUrl}`;
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