import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface SidebarItem {
  label: string;
  route?: string;
  href?: string;
  icon:
    | 'dashboard'
    | 'empresas'
    | 'usuarios'
    | 'reportes'
    | 'config'
    | 'inventario'
    | 'ventas'
    | 'finanzas'
    | 'analitica'
    | 'actividad'
    | 'suscripciones'
    | 'anuncios';
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class SidebarComponent {
  @Input() items: SidebarItem[] = [];
  @Input() avatarLabel = 'A';
  @Input() avatarSrc = '/LogoAlba.png';
  @Input() userName = 'Admin ALBA';
  @Input() userRole = 'Administrador';
  @Input() userId = 'EMP-0231';
  @Input() userDni = '00000000';
  @Input() userEmail = 'admin@vilcas.pe';
  @Input() userPhone = '+51 999 999 999';
  @Input() brandName = 'VILCAS';
  @Input() logoSrc = '/vilcas.png';
  @Input() brandAccentIndex = 4;

  showLogoFallback = false;
  showAvatarFallback = false;
  mobileOpen = false;

  /** Enlace del bloque "Powered by ALBA" del pie del sidebar. */
  readonly albaLinkedInUrl = 'https://www.linkedin.com/in/alba-ingenier%C3%ADa-de-desarrollo-42a3493ab/';

  onLogoError(event: Event): void {
    this.showLogoFallback = true;
    (event.target as HTMLImageElement).style.display = 'none';
  }

  toggleMobile(): void {
    this.mobileOpen = !this.mobileOpen;
  }

  closeMobile(): void {
    this.mobileOpen = false;
  }
}
