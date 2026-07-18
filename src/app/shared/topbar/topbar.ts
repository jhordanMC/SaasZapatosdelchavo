import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.css'],
})
export class TopbarComponent {
  constructor(private authService: AuthService, private router: Router) {}

  @Input() title = 'Dashboard';
  @Input() company = 'ALBA Corporation';
  @Input() avatarLabel = 'A';
  @Input() avatarSrc = '/LogoAlba.png';
  @Input() userName = 'Admin ALBA';
  @Input() userRole = 'Administrador';
  @Input() userId = 'EMP-0231';
  @Input() userDni = '00000000';
  @Input() userEmail = 'admin@vilcas.pe';
  @Input() userPhone = '+51 999 999 999';
  @Input() logoSrc = '/vilcas.png';
  @Input() brandName = 'VILCAS';
  @Input() brandAccentIndex = 4;

  showAvatarFallback = false;
  showProfileModal = false;

  openProfile(): void {
    this.showProfileModal = true;
  }

  closeProfile(): void {
    this.showProfileModal = false;
  }

  cerrarSesion(): void {
    this.showProfileModal = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}