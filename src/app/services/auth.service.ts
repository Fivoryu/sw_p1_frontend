import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { runtimeConfig } from '../shared/config/runtime-config';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  departamento?: string;
  empresa?: string;
  roles: string[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface ForgotPasswordResponse {
  success: boolean;
  resetToken?: string | null;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${runtimeConfig.apiV1BaseUrl}/auth`;
  private currentUserSubject: BehaviorSubject<AuthUser | null>;
  public currentUser: Observable<AuthUser | null>;
  private tokenKey = 'auth_token';
  private userKey = 'user';
  private storageFallbackTokenKey = 'auth_token_fallback';
  private storageFallbackUserKey = 'user_fallback';

  constructor(private http: HttpClient) {
    this.currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getUserFromStorage());
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          // Some browsers/extension combos can throw on localStorage in private mode.
          // Fall back to sessionStorage so login doesn't falsely look "failed".
          try {
            localStorage.setItem(this.tokenKey, response.token);
            localStorage.setItem(this.userKey, JSON.stringify(response.user));
          } catch {
            sessionStorage.setItem(this.storageFallbackTokenKey, response.token);
            sessionStorage.setItem(this.storageFallbackUserKey, JSON.stringify(response.user));
          }
          this.currentUserSubject.next(response.user);
        })
      );
  }

  forgotPassword(identifier: string, empresa?: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/password/forgot`, {
      identifier,
      empresa: empresa || null
    });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/password/reset`, {
      token,
      newPassword
    });
  }

  logout(): void {
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
    } catch {
      // ignore
    }
    sessionStorage.removeItem(this.storageFallbackTokenKey);
    sessionStorage.removeItem(this.storageFallbackUserKey);
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return sessionStorage.getItem(this.storageFallbackTokenKey);
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.currentUserValue;
  }

  hasRole(role: string): boolean {
    return this.currentUserValue?.roles?.includes(role) ?? false;
  }

  hasAnyRole(roles: string[]): boolean {
    const currentRoles = this.currentUserValue?.roles ?? [];
    return roles.some(role => currentRoles.includes(role));
  }

  isAdmin(): boolean {
    return this.hasRole('ROLE_ADMIN');
  }

  isOperator(): boolean {
    return this.hasRole('ROLE_REVISOR') || this.hasRole('ROLE_GERENTE');
  }

  isClient(): boolean {
    return this.hasRole('ROLE_CLIENTE');
  }

  getHomeRoute(): string {
    if (this.isAdmin()) {
      return '/admin/dashboard';
    }
    if (this.isOperator()) {
      return '/operator/dashboard';
    }
    return '/login';
  }

  private getUserFromStorage(): AuthUser | null {
    try {
      const userJson = localStorage.getItem(this.userKey);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      try {
        const userJson = sessionStorage.getItem(this.storageFallbackUserKey);
        return userJson ? JSON.parse(userJson) : null;
      } catch {
        console.error('Error parsing user from storage:', error);
        return null;
      }
    }
  }
}
