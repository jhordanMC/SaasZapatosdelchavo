import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth';
import { TPipe } from '../../core/t.pipe';

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
  imports: [CommonModule, RouterLink, RouterLinkActive, TPipe],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class SidebarComponent {
  constructor(private authService: AuthService, private router: Router) {}

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
  showProfileModal = false;
  mobileOpen = false;
  confirmandoCierre = false;

  onLogoError(event: Event): void {
    this.showLogoFallback = true;
    (event.target as HTMLImageElement).style.display = 'none';
  }

  openProfile(): void {
    this.showProfileModal = true;
  }

  closeProfile(): void {
    this.showProfileModal = false;
    this.confirmandoCierre = false;
  }

  toggleMobile(): void {
    this.mobileOpen = !this.mobileOpen;
  }

  closeMobile(): void {
    this.mobileOpen = false;
  }

  pedirConfirmacionCierre(): void {
    this.confirmandoCierre = true;
  }

  cancelarCierre(): void {
    this.confirmandoCierre = false;
  }

  cerrarSesion(): void {
    this.showProfileModal = false;
    this.confirmandoCierre = false;
    this.mobileOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
