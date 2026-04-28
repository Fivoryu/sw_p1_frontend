import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-password-recovery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="card">
        <div class="head">
          <div>
            <h1>Recuperar contraseña</h1>
            <p>Genera un token de recuperación y establece una nueva contraseña.</p>
          </div>
          <a class="link" routerLink="/login">Volver al login</a>
        </div>

        <div class="alert" *ngIf="error">
          <strong>Error:</strong> {{ error }}
        </div>

        <div class="grid">
          <section class="panel">
            <h3>1) Generar token</h3>
            <label>Usuario o email</label>
            <input [(ngModel)]="identifier" placeholder="Ej: admin / admin@correo.com" />
            <label>Empresa (opcional)</label>
            <input [(ngModel)]="empresa" placeholder="Ej: Workflow Cloud" />
            <button class="btn primary" type="button" (click)="requestToken()" [disabled]="loadingToken">
              {{ loadingToken ? 'Generando...' : 'Generar token' }}
            </button>

            <div class="token-box" *ngIf="resetToken">
              <div class="muted">Token (demo):</div>
              <code>{{ resetToken }}</code>
              <div class="muted small">Copialo y usalo en el paso 2.</div>
            </div>
          </section>

          <section class="panel">
            <h3>2) Resetear contraseña</h3>
            <label>Token</label>
            <input [(ngModel)]="token" placeholder="Pegá el token aquí" />
            <label>Nueva contraseña</label>
            <input [(ngModel)]="newPassword" type="password" placeholder="Mínimo 8 caracteres" />
            <button class="btn primary" type="button" (click)="reset()" [disabled]="loadingReset">
              {{ loadingReset ? 'Actualizando...' : 'Actualizar contraseña' }}
            </button>

            <div class="ok" *ngIf="successMessage">{{ successMessage }}</div>
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 20px; background: linear-gradient(180deg, #eef4f8 0%, #f8fafc 100%); }
    .card { width: min(980px, 100%); background: #fff; border-radius: 18px; border: 1px solid rgba(15,23,42,.08); box-shadow: 0 18px 40px rgba(15,23,42,.08); padding: 18px; }
    .head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    h1 { margin: 0; font-size: 26px; }
    p { margin: 6px 0 0; color: #475569; }
    .link { color: #2563eb; font-weight: 800; text-decoration: none; margin-top: 6px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
    .panel { border: 1px solid rgba(15,23,42,.10); border-radius: 16px; padding: 14px; background: #fbfdff; }
    h3 { margin: 0 0 10px; font-size: 16px; }
    label { display: block; font-size: 13px; font-weight: 800; color: #334155; margin-top: 10px; }
    input { width: 100%; border: 1px solid rgba(15,23,42,.14); border-radius: 12px; padding: 10px 12px; outline: none; margin-top: 6px; }
    .btn { margin-top: 12px; width: 100%; border-radius: 12px; padding: 10px 12px; border: 1px solid rgba(15,23,42,.12); background: #fff; font-weight: 900; cursor: pointer; }
    .btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .alert { margin-top: 12px; background: #fef2f2; color: #991b1b; border: 1px solid rgba(239,68,68,.25); border-radius: 14px; padding: 12px 14px; }
    .ok { margin-top: 12px; background: #ecfdf5; color: #065f46; border: 1px solid rgba(16,185,129,.25); border-radius: 14px; padding: 12px 14px; font-weight: 800; }
    .token-box { margin-top: 12px; background: #eff6ff; border: 1px solid rgba(37,99,235,.25); border-radius: 14px; padding: 12px 14px; }
    code { display: block; word-break: break-all; padding-top: 6px; color: #1d4ed8; font-weight: 900; }
    .muted { color: #64748b; font-weight: 800; }
    .muted.small { font-size: 12px; font-weight: 700; margin-top: 6px; }
    @media (max-width: 880px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class PasswordRecoveryComponent {
  identifier = '';
  empresa = '';

  resetToken: string | null = null;

  token = '';
  newPassword = '';

  loadingToken = false;
  loadingReset = false;
  error: string | null = null;
  successMessage: string | null = null;

  constructor(private authService: AuthService, private router: Router) {}

  requestToken(): void {
    this.error = null;
    this.successMessage = null;
    this.resetToken = null;
    this.loadingToken = true;

    this.authService.forgotPassword(this.identifier, this.empresa)
      .subscribe({
        next: (res) => {
          this.resetToken = res.resetToken ?? null;
          this.token = this.resetToken ?? this.token;
          this.loadingToken = false;
        },
        error: (e) => {
          this.error = e?.error?.message || e?.message || 'No se pudo generar el token';
          this.loadingToken = false;
        }
      });
  }

  reset(): void {
    this.error = null;
    this.successMessage = null;
    this.loadingReset = true;

    this.authService.resetPassword(this.token, this.newPassword)
      .subscribe({
        next: () => {
          this.successMessage = 'Contraseña actualizada. Ya podés iniciar sesión.';
          this.loadingReset = false;
          setTimeout(() => this.router.navigate(['/login']), 900);
        },
        error: (e) => {
          this.error = e?.error?.message || e?.message || 'No se pudo actualizar la contraseña';
          this.loadingReset = false;
        }
      });
  }
}

