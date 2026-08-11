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
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { CatalogoPublico, CatalogoPublicoService, ProductoPublico } from '../../../services/catalogo-publico';

@Component({
  selector: 'app-catalogo-publico',
  standalone: true,
  imports: [CommonModule],
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
}