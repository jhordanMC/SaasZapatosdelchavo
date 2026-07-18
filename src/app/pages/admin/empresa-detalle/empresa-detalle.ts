import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Empresa, EmpresasService, Local } from '../../../services/empresas';
import { PageTitleService } from '../../../shared/admin-layout/page-title';

@Component({
  selector: 'app-empresa-detalle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empresa-detalle.html',
  styleUrls: ['./empresa-detalle.css'],
})
export class EmpresaDetalleComponent implements OnInit {
  empresa = signal<Empresa | null>(null);
  locales = signal<Local[]>([]);
  cargando = signal(true);
  noEncontrada = signal(false);

  private idEmpresa: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private empresasService: EmpresasService,
    private pageTitleService: PageTitleService
  ) {
    this.idEmpresa = this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    if (!this.idEmpresa) {
      this.noEncontrada.set(true);
      this.cargando.set(false);
      return;
    }

    this.empresasService.obtenerEmpresa(this.idEmpresa).subscribe({
      next: (empresa) => {
        this.empresa.set(empresa);
        this.pageTitleService.setTitle(empresa.nombre);
        this.cargarLocales();
      },
      error: () => {
        this.noEncontrada.set(true);
        this.cargando.set(false);
      },
    });
  }

  private cargarLocales(): void {
    this.empresasService.listarLocales(this.idEmpresa).subscribe({
      next: (locales) => {
        this.locales.set(locales);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }

  volver(): void {
    this.router.navigate(['/admin/empresas']);
  }

  iniciales(nombre: string): string {
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }
}
