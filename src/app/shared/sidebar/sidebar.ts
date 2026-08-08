import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface SidebarSubItem {
  label: string;
  route: string;
  exact?: boolean;
}

export interface SidebarItem {
  label: string;
  route?: string;
  href?: string;
  /** Sub-enlaces bajo este ítem (ej. "Ventas" → "Ver Historial", "Proformas"). No es un submenú de varios niveles. */
  subItems?: SidebarSubItem[];
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
    | 'anuncios'
    | 'integraciones'
    | 'tickets';
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
  mobileOpen = false;
  collapsed = false;

  /** Enlace del bloque "Powered by ALBA" del pie del sidebar. */
  readonly albaLinkedInUrl = 'https://www.linkedin.com/in/alba-engineering-development-42a3493ab?utm_source=share_via&utm_content=profile&utm_medium=member_android';

  private readonly COLLAPSE_STORAGE_KEY = 'vilcas.sidebar.collapsed';

  constructor() {
    this.collapsed = localStorage.getItem(this.COLLAPSE_STORAGE_KEY) === '1';
  }

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

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem(this.COLLAPSE_STORAGE_KEY, this.collapsed ? '1' : '0');
  }
}
