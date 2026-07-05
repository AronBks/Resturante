import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { RolUsuario } from '@sggi/shared';

export interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

export interface LoginResponse {
  success: boolean;
  data: {
    usuario: UserProfile;
    access_token: string;
    refresh_token: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = 'http://localhost:3000/api/auth';
  
  // Usamos Angular Signals para un manejo de estado reactivo y de alto rendimiento
  currentUserSignal = signal<UserProfile | null>(null);
  
  // Signals computados para consultar el estado de autenticación de forma sencilla
  isAuthenticated = computed(() => this.currentUserSignal() !== null);
  userRole = computed(() => this.currentUserSignal()?.rol ?? null);

  constructor(private http: HttpClient, private router: Router) {
    this.loadSession();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((response) => {
        if (response.success && response.data) {
          const { usuario, access_token, refresh_token } = response.data;
          this.saveSession(usuario, access_token, refresh_token);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('sggi_user');
    localStorage.removeItem('sggi_at');
    localStorage.removeItem('sggi_rt');
    this.currentUserSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('sggi_at');
  }

  hasRole(allowedRoles: RolUsuario[]): boolean {
    const user = this.currentUserSignal();
    return user !== null && allowedRoles.includes(user.rol);
  }

  private saveSession(user: UserProfile, at: string, rt: string): void {
    localStorage.setItem('sggi_user', JSON.stringify(user));
    localStorage.setItem('sggi_at', at);
    localStorage.setItem('sggi_rt', rt);
    this.currentUserSignal.set(user);
  }

  private loadSession(): void {
    const userJson = localStorage.getItem('sggi_user');
    const token = localStorage.getItem('sggi_at');
    if (userJson && token) {
      try {
        const user = JSON.parse(userJson) as UserProfile;
        this.currentUserSignal.set(user);
      } catch {
        this.logout();
      }
    }
  }
}
