import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AdminUser, CreateUserRequest, UserService } from '../../../services/user.service';

type UiMode = 'list' | 'create' | 'edit';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h2>Usuarios</h2>
          <p>Gestiona cuentas de tu empresa, sus roles y estado.</p>
        </div>
        <div class="actions">
          <button class="btn" type="button" (click)="reload()" [disabled]="loading()">Recargar</button>
          <button class="btn primary" type="button" (click)="startCreate()" [disabled]="loading()">+ Nuevo usuario</button>
        </div>
      </div>

      <div class="card" *ngIf="error()">
        <div class="alert">
          <strong>Error:</strong> {{ error() }}
        </div>
      </div>

      <div class="card" *ngIf="mode() !== 'list'">
        <div class="form-head">
          <strong>{{ mode() === 'create' ? 'Crear usuario' : 'Editar usuario' }}</strong>
          <button class="btn" type="button" (click)="cancelEdit()" [disabled]="saving()">Volver</button>
        </div>

        <form (ngSubmit)="save()" #f="ngForm" class="form-grid">
          <div class="field" *ngIf="mode() === 'create'">
            <label>Usuario</label>
            <input name="username" [(ngModel)]="draft.username" required minlength="3" />
          </div>

          <div class="field">
            <label>Email</label>
            <input name="email" [(ngModel)]="draft.email" required type="email" />
          </div>

          <div class="field" *ngIf="mode() === 'create'">
            <label>Contraseña inicial</label>
            <input name="password" [(ngModel)]="draft.password" required minlength="6" type="password" />
          </div>

          <div class="field">
            <label>Departamento</label>
            <input name="departamento" [(ngModel)]="draft.departamento" placeholder="Ej: Operaciones" />
          </div>

          <div class="field">
            <label>Roles</label>
            <div class="roles">
              <label class="role" *ngFor="let r of availableRoles()">
                <input
                  type="checkbox"
                  [checked]="draft.roles.includes(r)"
                  (change)="toggleRole(r, $any($event.target).checked)"
                />
                <span>{{ r }}</span>
              </label>
            </div>
          </div>

          <div class="field row">
            <label class="switch">
              <input type="checkbox" name="active" [(ngModel)]="draft.active" />
              <span>Activo</span>
            </label>
          </div>

          <div class="form-actions">
            <button class="btn primary" type="submit" [disabled]="saving() || f.invalid">
              {{ saving() ? 'Guardando...' : 'Guardar' }}
            </button>
            <button class="btn danger" type="button" *ngIf="mode() === 'edit' && selectedUser()" (click)="deactivate()" [disabled]="saving()">
              Desactivar usuario
            </button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="table-tools">
          <input class="search" [(ngModel)]="filter" placeholder="Buscar por usuario, email o departamento..." />
          <span class="muted" *ngIf="loading()">Cargando...</span>
          <span class="muted" *ngIf="!loading()">{{ filteredUsers().length }} usuarios</span>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Departamento</th>
                <th>Roles</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of filteredUsers()">
                <td>
                  <strong>{{ u.username }}</strong>
                  <div class="muted small" *ngIf="u.empresa">Empresa: {{ u.empresa }}</div>
                </td>
                <td>{{ u.email }}</td>
                <td>{{ u.departamento || '—' }}</td>
                <td class="roles-cell">
                  <span class="pill" *ngFor="let r of u.roles">{{ r }}</span>
                </td>
                <td>
                  <span class="status" [class.off]="!u.active">{{ u.active ? 'Activo' : 'Inactivo' }}</span>
                </td>
                <td class="right">
                  <button class="btn" type="button" (click)="startEdit(u)">Editar</button>
                </td>
              </tr>
              <tr *ngIf="!loading() && filteredUsers().length === 0">
                <td colspan="6" class="empty">No hay usuarios para mostrar.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { display: grid; gap: 16px; }
    .page-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 10px 4px; }
    h2 { margin: 0; font-size: 26px; }
    p { margin: 6px 0 0; color: #475569; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .card { background: #ffffff; border-radius: 18px; padding: 16px; border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 20px rgba(15,23,42,.05); }
    .btn { border: 1px solid rgba(15,23,42,.12); background: #fff; border-radius: 12px; padding: 10px 12px; cursor: pointer; font-weight: 700; }
    .btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    .btn.danger { background: #ef4444; border-color: #ef4444; color: #fff; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .alert { background: #fef2f2; color: #991b1b; border: 1px solid rgba(239,68,68,.25); border-radius: 14px; padding: 12px 14px; }
    .form-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
    .form-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .field { display: grid; gap: 6px; }
    .field.row { grid-column: 1 / -1; }
    label { font-size: 13px; color: #334155; font-weight: 800; }
    input { border: 1px solid rgba(15,23,42,.14); border-radius: 12px; padding: 10px 12px; outline: none; }
    input:focus { border-color: rgba(37,99,235,.6); box-shadow: 0 0 0 4px rgba(37,99,235,.15); }
    .roles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 10px; border: 1px dashed rgba(15,23,42,.18); border-radius: 14px; background: #f8fafc; }
    .role { display: flex; gap: 8px; align-items: center; font-weight: 700; color: #0f172a; }
    .switch { display: inline-flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(15,23,42,.12); width: fit-content; }
    .form-actions { display: flex; gap: 10px; flex-wrap: wrap; grid-column: 1 / -1; padding-top: 6px; }
    .table-tools { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
    .search { flex: 1 1 auto; min-width: 280px; }
    .muted { color: #64748b; font-weight: 700; }
    .muted.small { font-size: 12px; font-weight: 600; }
    .table-wrap { overflow: auto; }
    .table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid rgba(15,23,42,.08); vertical-align: top; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #475569; }
    .pill { display: inline-flex; padding: 6px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-weight: 800; font-size: 12px; margin: 0 6px 6px 0; }
    .status { display: inline-flex; padding: 6px 10px; border-radius: 999px; background: rgba(34,197,94,.12); color: #166534; font-weight: 900; }
    .status.off { background: rgba(239,68,68,.12); color: #991b1b; }
    .right { text-align: right; }
    .empty { text-align: center; padding: 18px 10px; color: #64748b; font-weight: 700; }
    @media (max-width: 900px) {
      .form-grid { grid-template-columns: 1fr; }
      .roles { grid-template-columns: 1fr; }
    }
  `]
})
export class UserManagementComponent {
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  mode = signal<UiMode>('list');

  users = signal<AdminUser[]>([]);
  availableRoles = signal<string[]>([]);
  selectedUser = signal<AdminUser | null>(null);

  filter = '';

  draft: {
    username: string;
    email: string;
    password: string;
    departamento: string;
    roles: string[];
    active: boolean;
  } = {
    username: '',
    email: '',
    password: '',
    departamento: '',
    roles: [],
    active: true
  };

  filteredUsers = computed(() => {
    const q = this.filter.trim().toLowerCase();
    const list = this.users();
    if (!q) return list;
    return list.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.departamento || '').toLowerCase().includes(q)
    );
  });

  constructor(private userService: UserService) {
    this.reload();
    this.userService.listAvailableRoles().subscribe({
      next: roles => this.availableRoles.set((roles || []).slice().sort()),
      error: () => this.availableRoles.set([])
    });
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.userService.listUsers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: users => this.users.set(users ?? []),
        error: (e) => this.error.set(e?.error?.message || e?.message || 'No se pudieron cargar los usuarios')
      });
  }

  startCreate(): void {
    this.mode.set('create');
    this.selectedUser.set(null);
    this.resetDraft();
  }

  startEdit(u: AdminUser): void {
    this.mode.set('edit');
    this.selectedUser.set(u);
    this.draft.username = u.username;
    this.draft.email = u.email;
    this.draft.password = '';
    this.draft.departamento = u.departamento ?? '';
    this.draft.roles = (u.roles ?? []).slice();
    this.draft.active = !!u.active;
  }

  cancelEdit(): void {
    this.mode.set('list');
    this.selectedUser.set(null);
    this.resetDraft();
  }

  toggleRole(role: string, checked: boolean): void {
    const set = new Set(this.draft.roles ?? []);
    if (checked) set.add(role);
    else set.delete(role);
    this.draft.roles = Array.from(set);
  }

  save(): void {
    this.error.set(null);
    this.saving.set(true);

    const mode = this.mode();
    if (mode === 'create') {
      const payload: CreateUserRequest = {
        username: this.draft.username.trim(),
        email: this.draft.email.trim(),
        password: this.draft.password,
        roles: this.draft.roles ?? [],
        departamento: this.draft.departamento.trim() || undefined
      };
      this.userService.createUser(payload)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: created => {
            this.users.set([created, ...this.users()]);
            this.cancelEdit();
          },
          error: (e) => this.error.set(e?.error?.message || e?.message || 'No se pudo crear el usuario')
        });
      return;
    }

    const selected = this.selectedUser();
    if (!selected) {
      this.saving.set(false);
      this.error.set('No hay usuario seleccionado para editar');
      return;
    }

    const payload = {
      email: this.draft.email.trim(),
      roles: this.draft.roles ?? [],
      departamento: this.draft.departamento.trim() || undefined,
      active: this.draft.active
    };

    this.userService.updateUser(selected.id, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: updated => {
          this.users.set(this.users().map(u => (u.id === updated.id ? updated : u)));
          this.selectedUser.set(updated);
          this.mode.set('list');
          this.resetDraft();
        },
        error: (e) => this.error.set(e?.error?.message || e?.message || 'No se pudo actualizar el usuario')
      });
  }

  deactivate(): void {
    const selected = this.selectedUser();
    if (!selected) return;
    this.error.set(null);
    this.saving.set(true);
    this.userService.deactivateUser(selected.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.users.set(this.users().map(u => (u.id === selected.id ? { ...u, active: false } : u)));
          this.cancelEdit();
        },
        error: (e) => this.error.set(e?.error?.message || e?.message || 'No se pudo desactivar el usuario')
      });
  }

  private resetDraft(): void {
    this.draft = {
      username: '',
      email: '',
      password: '',
      departamento: '',
      roles: [],
      active: true
    };
  }
}

