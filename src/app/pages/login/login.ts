import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {

  email: string = '';
  password: string = '';
  remember: boolean = true;
  showPassword: boolean = false;
  showLogoFallback: boolean = false;

  constructor(private router: Router) {}

  togglePwd(): void {
    this.showPassword = !this.showPassword;
  }

  onLogoError(event: Event): void {
    this.showLogoFallback = true;
    (event.target as HTMLImageElement).style.display = 'none';
  }

  onSubmit(): void {
    // TODO: conectar con el servicio de autenticación real
    console.log('Login intento:', { email: this.email, remember: this.remember });
    this.router.navigate(['/admin/dashboard']);
  }
}