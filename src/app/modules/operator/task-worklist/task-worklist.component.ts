import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { OperatorTask } from '../../../shared/models/workflow.model';
import { WorkflowService } from '../../../shared/services/workflow.service';

@Component({
  selector: 'app-task-worklist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">CU8 · Worklist</span>
          <h2>Bandeja de tareas</h2>
          <p>{{ currentDepartment }} · {{ filteredTasks.length }} tareas visibles para tu atención</p>
        </div>
        <div class="header-actions">
          <button class="secondary-btn" type="button" (click)="refresh()">Actualizar</button>
        </div>
      </header>

      <section class="filter-bar">
        <select [(ngModel)]="statusFilter">
          <option value="ALL">Todos los estados</option>
          <option value="PENDING">Pendientes</option>
          <option value="IN_PROGRESS">En proceso</option>
        </select>
        <select [(ngModel)]="priorityFilter">
          <option value="ALL">Todas las prioridades</option>
          <option value="HIGH">Alta</option>
          <option value="MEDIUM">Media</option>
          <option value="NORMAL">Normal</option>
        </select>
        <input [(ngModel)]="searchTerm" placeholder="Buscar por cliente, trámite o tarea" />
        <input [(ngModel)]="fromDate" type="date" />
      </section>

      <section class="stats-grid">
        <article class="stat-card">
          <span class="stat-label">Pendientes</span>
          <strong class="stat-value">{{ pendingCount }}</strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">En proceso</span>
          <strong class="stat-value">{{ inProgressCount }}</strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">Urgentes</span>
          <strong class="stat-value">{{ urgentCount }}</strong>
        </article>
      </section>

      <div class="table-card" *ngIf="filteredTasks.length; else emptyState">
        <div class="table-header">
          <span>ID Trámite</span>
          <span>Cliente</span>
          <span>Tarea actual</span>
          <span>Estado</span>
          <span>Prioridad</span>
          <span>Acción</span>
        </div>

        <article *ngFor="let task of filteredTasks" class="table-row">
          <div>
            <strong>{{ task.workflowInstanceId }}</strong>
            <small>{{ task.departamentoAsignado }}</small>
          </div>
          <div>
            <strong>{{ task.clienteNombre || 'Sin dato' }}</strong>
            <small>{{ task.clienteDni || 'Sin documento' }}</small>
          </div>
          <div>
            <strong>{{ task.nombreTarea }}</strong>
            <small>{{ task.fechaCreacion | date:'short' }}</small>
          </div>
          <div>
            <span class="status-chip" [class.in-progress]="task.estado === 'IN_PROGRESS'">{{ task.estado }}</span>
          </div>
          <div>
            <span class="priority-chip" [class.high]="task.prioridad === 'HIGH'" [class.medium]="task.prioridad === 'MEDIUM'">
              {{ task.prioridad || 'NORMAL' }}
            </span>
          </div>
          <div class="row-actions">
            <button class="secondary-btn ghost-btn" type="button" (click)="viewDetail(task.id)">Ver detalle</button>
            <button class="secondary-btn ghost-btn" type="button" (click)="openHistory(task.workflowInstanceId)">Ver historial</button>
            <button class="primary-btn" type="button" (click)="takeTask(task.id)">
              {{ task.usuarioAsignado ? 'Continuar' : 'Tomar tarea' }}
            </button>
          </div>
        </article>
      </div>

      <ng-template #emptyState>
        <section class="empty-box">
          <h3>Bandeja sin coincidencias</h3>
          <p>Si estás usando un usuario demo principal, revisa que el backend haya arrancado con el seeder actualizado y que tu departamento tenga trámites sembrados.</p>
        </section>
      </ng-template>

      <p *ngIf="feedback" class="feedback">{{ feedback }}</p>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 18px; }
    .page-header { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; color: #0f766e; font-weight: 700; }
    .page-header h2 { margin: 8px 0 6px; font-size: 30px; }
    .page-header p { margin: 0; color: #64748b; }
    .header-actions { display: flex; gap: 10px; }
    .filter-bar, .stat-card, .table-card, .empty-box { background: rgba(255,255,255,.9); border: 1px solid #dbe4f0; border-radius: 24px; box-shadow: 0 18px 40px rgba(15,23,42,.08); }
    .filter-bar { padding: 16px; display: grid; grid-template-columns: 220px 220px minmax(220px, 1fr) 180px; gap: 12px; }
    select, input { width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .stat-card { padding: 16px 18px; display: grid; gap: 8px; }
    .stat-label { color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
    .stat-value { font-size: 28px; }
    .table-card { overflow: hidden; }
    .table-header, .table-row { display: grid; grid-template-columns: 1.1fr 1fr 1.2fr .8fr .8fr 260px; gap: 12px; padding: 16px 18px; align-items: center; }
    .table-header { background: #ecfeff; font-weight: 700; color: #155e75; }
    .table-row { border-top: 1px solid #eef2f7; background: #fff; }
    .table-row strong, .table-row small { display: block; }
    .table-row small { color: #64748b; margin-top: 4px; }
    .status-chip, .priority-chip { display: inline-flex; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .status-chip { background: #dbeafe; color: #1d4ed8; }
    .status-chip.in-progress { background: #dcfce7; color: #166534; }
    .priority-chip { background: #e2e8f0; color: #334155; }
    .priority-chip.high { background: #fee2e2; color: #991b1b; }
    .priority-chip.medium { background: #ffedd5; color: #9a3412; }
    .primary-btn, .secondary-btn { border: 0; border-radius: 14px; padding: 11px 16px; cursor: pointer; font-weight: 700; }
    .primary-btn { background: #0f766e; color: #fff; }
    .secondary-btn { background: #e2e8f0; color: #0f172a; }
    .ghost-btn { padding: 9px 12px; }
    .row-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .empty-box { padding: 24px; }
    .empty-box h3 { margin: 0 0 10px; }
    .empty-box p, .feedback { margin: 0; color: #64748b; }
    .feedback { color: #0369a1; }
    @media (max-width: 1100px) {
      .filter-bar, .stats-grid { grid-template-columns: 1fr; }
      .table-header { display: none; }
      .table-row { grid-template-columns: 1fr; }
    }
  `]
})
export class TaskWorklistComponent implements OnInit, OnDestroy {
  tasks: OperatorTask[] = [];
  feedback = '';
  currentDepartment = '';
  statusFilter = 'ALL';
  priorityFilter = 'ALL';
  searchTerm = '';
  fromDate = '';
  private sockets: WebSocket[] = [];

  constructor(
    private workflowService: WorkflowService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentDepartment = this.authService.currentUserValue?.departamento ?? 'Departamento no identificado';
    this.refresh();
    this.connectRealtime();
  }

  ngOnDestroy(): void {
    this.sockets.forEach(socket => socket.close());
  }

  get filteredTasks(): OperatorTask[] {
    return this.tasks.filter(task => {
      const matchesStatus = this.statusFilter === 'ALL' || task.estado === this.statusFilter;
      const matchesPriority = this.priorityFilter === 'ALL' || (task.prioridad || 'NORMAL') === this.priorityFilter;
      const query = this.searchTerm.trim().toLowerCase();
      const haystack = [
        task.workflowInstanceId,
        task.clienteNombre,
        task.nombreTarea,
        task.departamentoAsignado
      ].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const created = task.fechaCreacion ? new Date(task.fechaCreacion) : null;
      const matchesDate = !this.fromDate || (created !== null && created >= new Date(`${this.fromDate}T00:00:00`));
      return matchesStatus && matchesPriority && matchesSearch && matchesDate;
    });
  }

  get pendingCount(): number {
    return this.tasks.filter(task => task.estado === 'PENDING').length;
  }

  get inProgressCount(): number {
    return this.tasks.filter(task => task.estado === 'IN_PROGRESS').length;
  }

  get urgentCount(): number {
    return this.tasks.filter(task => task.prioridad === 'HIGH').length;
  }

  refresh(): void {
    this.workflowService.getOperatorInbox().subscribe({
      next: tasks => {
        this.tasks = tasks;
        this.feedback = '';
      },
      error: () => this.feedback = 'No se pudo cargar la bandeja del funcionario.'
    });
  }

  takeTask(taskId: string): void {
    this.workflowService.claimOperatorTask(taskId).subscribe({
      next: detail => {
        this.router.navigate(['/operator/tasks', taskId], { state: { taskDetail: detail } });
      },
      error: error => {
        this.feedback = error.error?.message ?? 'No se pudo reclamar la tarea.';
      }
    });
  }

  viewDetail(taskId: string): void {
    this.router.navigate(['/operator/tasks', taskId]);
  }

  openHistory(instanceId: string): void {
    this.router.navigate(['/operator/history'], { queryParams: { instance: instanceId } });
  }

  private connectRealtime(): void {
    const roles = this.authService.currentUserValue?.roles ?? [];
    roles.forEach(role => {
      const socket = new WebSocket(`ws://localhost:8080/api/ws/operator/roles/${role}`);
      socket.onmessage = () => this.refresh();
      this.sockets.push(socket);
    });
  }
}
