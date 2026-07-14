import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Empresa, EmpresasService, TipoEmpresa } from '../../../services/empresas';
import { PageTitleService } from '../../../shared/admin-layout/page-title';

@Component({
  selector: 'app-empresa-detalle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empresa-detalle.html',
  styleUrls: ['./empresa-detalle.css'],
})
export class EmpresaDetalleComponent {
  empresa: Empresa | undefined;

  tipoStyle: Record<TipoEmpresa, string> = {
    Banca: 'tipo-banca',
    Seguros: 'tipo-seguros',
    Telecomunicaciones: 'tipo-telco',
    Retail: 'tipo-retail',
    Financiero: 'tipo-financiero',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private empresasService: EmpresasService,
    private pageTitleService: PageTitleService
  ) {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.empresa = this.empresasService.getEmpresaById(id);
    // Sobrescribe el título por defecto de la ruta ("Detalle de empresa")
    // con el nombre real de la empresa cargada.
    this.pageTitleService.setTitle(this.empresa ? this.empresa.nombre : 'Empresa');
  }

  volver(): void {
    this.router.navigate(['/admin/empresas']);
  }

  iniciales(nombre: string): string {
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) return palabras[0].substring(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  fmtUSD(value: number): string {
    return value === 0 ? '—' : `$${value.toLocaleString('en-US')}`;
  }
}