import { Component, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RolUsuario } from '@sggi/shared';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  constructor(private authService: AuthService, private router: Router) {
    // Si ya está autenticado, redirigir
    if (this.authService.isAuthenticated()) {
      this.redirectUserByRole(this.authService.userRole()!);
    }
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set('Por favor, completa todos los campos.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success && response.data) {
          const user = response.data.usuario;
          this.redirectUserByRole(user.rol);
        }
      },
      error: (err) => {
        this.loading.set(false);
        const backendError = err.error?.message;
        if (Array.isArray(backendError)) {
          this.errorMessage.set(backendError[0]);
        } else if (typeof backendError === 'string') {
          this.errorMessage.set(backendError);
        } else {
          this.errorMessage.set('Error de conexión con el servidor. Inténtalo de nuevo.');
        }
      },
    });
  }

  private redirectUserByRole(rol: RolUsuario): void {
    if (rol === RolUsuario.MESERO) {
      this.router.navigate(['/dashboard/mesas']);
    } else if (rol === RolUsuario.CHEF) {
      this.router.navigate(['/dashboard/cocina']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
