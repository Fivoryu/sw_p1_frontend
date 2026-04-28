import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin-shell-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell" [class.collapsed]="collapsed">
      <aside class="sidebar">
        <div class="sidebar-top">
          <button class="toggle-btn" type="button" (click)="toggleSidebar()">
            {{ collapsed ? '→' : '←' }}
          </button>
          <div class="brand" *ngIf="!collapsed">
            <span class="eyebrow">Backoffice</span>
            <h1>Workflow Admin</h1>
            <p>Políticas, formularios, departamentos y supervisión general.</p>
          </div>
        </div>

        <nav class="nav">
          <a
            *ngFor="let item of navItems"
            [routerLink]="item.route"
            routerLinkActive="active"
            class="nav-link"
          >
            <span class="icon">{{ item.icon }}</span>
            <span *ngIf="!collapsed" class="nav-copy">
              <strong>{{ item.label }}</strong>
              <small>{{ item.description }}</small>
            </span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <span class="user-chip" *ngIf="!collapsed">{{ authService.currentUserValue?.username }}</span>
          <button class="logout-btn" type="button" (click)="logout()">
            <span class="icon">⎋</span>
            <span *ngIf="!collapsed">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div class="content-area">
        <header class="topbar">
          <div>
            <span class="eyebrow">Administración</span>
            <strong>{{ currentSectionLabel }}</strong>
          </div>
          <div class="topbar-meta">
            <span class="tenant-chip">{{ authService.currentUserValue?.empresa || 'Sin empresa' }}</span>
          </div>
        </header>

        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 290px minmax(0, 1fr); background: linear-gradient(180deg, #eef4f8 0%, #f8fafc 100%); transition: grid-template-columns .2s ease; }
    .shell.collapsed { grid-template-columns: 88px minmax(0, 1fr); }
    .sidebar { background: linear-gradient(180deg, #0f172a 0%, #172554 100%); color: #e2e8f0; padding: 20px 16px; display: grid; grid-template-rows: auto 1fr auto; gap: 18px; position: sticky; top: 0; height: 100vh; }
    .sidebar-top { display: grid; gap: 14px; }
    .toggle-btn { width: 42px; height: 42px; border: 0; border-radius: 14px; background: rgba(148,163,184,.16); color: #fff; cursor: pointer; }
    .brand h1 { margin: 8px 0; font-size: 28px; line-height: 1.05; }
    .brand p { margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.5; }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; color: #93c5fd; font-weight: 700; }
    .nav { display: grid; gap: 8px; align-content: start; }
    .nav-link, .logout-btn { display: flex; align-items: center; gap: 12px; text-decoration: none; border: 0; border-radius: 14px; padding: 12px 14px; color: #e2e8f0; background: transparent; cursor: pointer; }
    .nav-link.active, .nav-link:hover, .logout-btn:hover { background: rgba(59,130,246,.22); }
    .nav-copy { display: grid; gap: 2px; }
    .nav-copy strong { font-size: 14px; line-height: 1.2; }
    .nav-copy small { color: #cbd5e1; font-size: 12px; line-height: 1.2; }
    .icon { width: 18px; text-align: center; flex: 0 0 auto; }
    .sidebar-footer { display: grid; gap: 10px; }
    .user-chip { display: inline-flex; width: fit-content; padding: 8px 12px; border-radius: 999px; background: rgba(59,130,246,.18); font-weight: 700; }
    .content-area { min-width: 0; display: grid; grid-template-rows: auto 1fr; }
    .topbar { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 18px 28px 12px; }
    .topbar > div:first-child { display: grid; gap: 3px; }
    .topbar-meta { color: #475569; font-weight: 600; }
    .tenant-chip { display: inline-flex; padding: 8px 12px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 13px; }
    .content { min-width: 0; padding: 0 24px 24px; }
    @media (max-width: 960px) {
      .shell, .shell.collapsed { grid-template-columns: 1fr; }
      .sidebar { position: static; height: auto; grid-template-rows: auto auto auto; }
      .content { padding: 0 14px 18px; }
      .topbar { padding: 14px; }
    }
  `]
})
export class AdminShellLayoutComponent {
  collapsed = localStorage.getItem('admin_sidebar_collapsed') === 'true';
  readonly navItems = [
    { route: '/admin/dashboard', icon: '⌂', label: 'Dashboard', description: 'Resumen ejecutivo' },
    { route: '/admin/policies', icon: '◫', label: 'Políticas', description: 'BPMN, formularios y publicación' },
    { route: '/admin/departments', icon: '▤', label: 'Departamentos', description: 'Áreas y roles operativos' },
    { route: '/admin/users', icon: '👤', label: 'Usuarios', description: 'Cuentas, roles y estado' },
    { route: '/admin/simulation', icon: '∿', label: 'Simulación', description: 'Cuellos de botella (IA)' }
  ];

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  toggleSidebar(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem('admin_sidebar_collapsed', String(this.collapsed));
  }

  get currentSectionLabel(): string {
    if (this.router.url.startsWith('/admin/policies') || this.router.url.startsWith('/admin/workflows')) {
      return 'Editor de políticas';
    }
    if (this.router.url.startsWith('/admin/departments')) {
      return 'Gestión de departamentos';
    }
    if (this.router.url.startsWith('/admin/users')) {
      return 'Gestión de usuarios';
    }
    if (this.router.url.startsWith('/admin/simulation')) {
      return 'Simulación y métricas';
    }
    return 'Dashboard administrativo';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
