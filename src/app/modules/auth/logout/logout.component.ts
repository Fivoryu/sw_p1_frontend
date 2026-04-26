import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

/**
 * CU2: Cerrar Sesión
 * Componente auxiliar para manejar el logout
 */
@Component({
  selector: 'app-logout',
  template: ''
})
export class LogoutComponent {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.logout();
  }

  /**
   * Ejecuta el logout y redirige al login
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
