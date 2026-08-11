/**
 * Vista pública de un catálogo (/c/:slug) — sin login, la ve cualquier
 * visitante con el enlace. Consume CatalogoPublicoService (GET
 * /public/catalogos/{slug}, sin auth), que suma una visita en cada llamada.
 *
 * A propósito NO usa PublicLayoutComponent (nav + footer de marketing de
 * VILCAS): esta página es la vitrina de PRODUCTOS DE LA EMPRESA, con su
 * propio color de marca — no debe verse como parte del sitio de VILCAS.
 */
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { CatalogoPublico, CatalogoPublicoService, ProductoPublico } from '../../../services/catalogo-publico';

const TODOS = 'Todos';

@Component({
  selector: 'app-catalogo-publico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo-publico.html',
  styleUrl: './catalogo-publico.css',
})
export class CatalogoPublicoComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private catalogoPublicoService: CatalogoPublicoService
  ) {}

  catalogo = signal<CatalogoPublico | null>(null);
  cargando = signal(true);
  /** true solo cuando el backend responde 404 (slug inexistente o catálogo despublicado) — distinto de un error de red. */
  noEncontrado = signal(false);

  // ── Filtro por categoría + búsqueda ─────────────────────────────────────
  // Ambos client-side: los productos del catálogo ya vienen completos en un
  // solo GET (no hay paginación), así que no vale la pena ida y vuelta al
  // backend por cada tab o cada letra escrita.
  categoriaActiva = signal(TODOS);
  busqueda = signal('');

  /** "Todos" + cada categoría distinta que tenga al menos un producto en ESTE catálogo, en el orden en que aparecen. */
  categoriasDisponibles = computed(() => {
    const productos = this.catalogo()?.productos ?? [];
    const vistas = new Set<string>();
    const categorias: string[] = [TODOS];
    for (const p of productos) {
      if (p.categoria && !vistas.has(p.categoria)) {
        vistas.add(p.categoria);
        categorias.push(p.categoria);
      }
    }
    return categorias;
  });

  productosFiltrados = computed(() => {
    const productos = this.catalogo()?.productos ?? [];
    const categoria = this.categoriaActiva();
    const termino = this.busqueda().trim().toLowerCase();
    return productos.filter((p) => {
      const coincideCategoria = categoria === TODOS || p.categoria === categoria;
      const coincideBusqueda = !termino || p.nombre.toLowerCase().includes(termino);
      return coincideCategoria && coincideBusqueda;
    });
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.noEncontrado.set(true);
      this.cargando.set(false);
      return;
    }
    this.catalogoPublicoService.obtenerPorSlug(slug).subscribe({
      next: (catalogo) => {
        this.catalogo.set(catalogo);
        this.cargando.set(false);
      },
      error: (err) => {
        if (err?.status === 404) this.noEncontrado.set(true);
        this.cargando.set(false);
      },
    });
  }

  /** imagen_url del backend guarda solo la ruta relativa (/uploads/...) — arma la URL absoluta contra la API. */
  imagenSrc(producto: ProductoPublico): string | null {
    if (!producto.imagen_url) return null;
    return producto.imagen_url.startsWith('http')
      ? producto.imagen_url
      : `${environment.apiUrl}${producto.imagen_url}`;
  }

  /** Mismo criterio que imagenSrc() pero para la portada del catálogo. */
  portadaSrc(catalogo: CatalogoPublico): string | null {
    if (!catalogo.imagen_portada_url) return null;
    return catalogo.imagen_portada_url.startsWith('http')
      ? catalogo.imagen_portada_url
      : `${environment.apiUrl}${catalogo.imagen_portada_url}`;
  }

  /** null si el catálogo no configuró whatsapp_numero — el botón flotante no se renderiza en ese caso. */
  enlaceWhatsApp(catalogo: CatalogoPublico): string | null {
    if (!catalogo.whatsapp_numero) return null;
    const texto = encodeURIComponent(`Hola, quiero más información sobre ${catalogo.nombre}`);
    return `https://wa.me/${catalogo.whatsapp_numero}?text=${texto}`;
  }
}