import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OperatorTask } from '../../../shared/models/workflow.model';
import { WorkflowService } from '../../../shared/services/workflow.service';

@Component({
  selector: 'app-operator-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="dashboard">
      <section class="hero-card">
        <div>
          <span class="eyebrow">Operación diaria</span>
          <h2>Resumen del funcionario</h2>
          <p>Panel centrado en CU-14 a CU-21: bandeja, reclamo, formularios, derivación, historial y búsqueda operativa.</p>
        </div>
        <button class="primary-btn" type="button" (click)="goToInbox()">Ir a la bandeja</button>
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
        <article class="stat-card">
          <span class="stat-label">Vencidas</span>
          <strong class="stat-value">{{ overdueCount }}</strong>
        </article>
      </section>

      <section class="content-grid">
        <article class="panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">Accesos rápidos</span>
              <h3>Casos de uso del funcionario</h3>
            </div>
          </div>

          <div class="use-case-grid">
            <button class="use-case-card" type="button" (click)="goToInbox()">
              <span class="use-case-id">CU-14</span>
              <strong>Visualizar bandeja</strong>
              <p>Consulta tareas pendientes por departamento y prioridad.</p>
            </button>
            <button class="use-case-card" type="button" (click)="goToInbox()">
              <span class="use-case-id">CU-16</span>
              <strong>Cumplimentar formulario</strong>
              <p>Completa el formulario dinámico asociado al nodo actual.</p>
            </button>
            <button class="use-case-card" type="button" (click)="goToInbox()">
              <span class="use-case-id">CU-18</span>
              <strong>Derivar trámite</strong>
              <p>Avanza el flujo según la política publicada y el contexto del caso.</p>
            </button>
            <button class="use-case-card" type="button" (click)="goToHistory()">
              <span class="use-case-id">CU-20</span>
              <strong>Consultar historial</strong>
              <p>Revisa trazabilidad, formularios completados y eventos previos.</p>
            </button>
          </div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">Atención inmediata</span>
              <h3>Tareas para atender hoy</h3>
            </div>
          </div>

          <div *ngIf="!tasks.length" class="empty-box">
            Aún no hay tareas visibles para tu departamento. Cuando el seeder cargue correctamente, aquí verás trabajo real.
          </div>

          <div *ngIf="tasks.length" class="task-list">
            <article *ngFor="let task of previewTasks" class="task-card">
              <div class="task-main">
                <div class="task-head">
                  <strong>{{ task.nombreTarea }}</strong>
                  <span class="priority-chip" [class.high]="task.prioridad === 'HIGH'">{{ task.prioridad || 'NORMAL' }}</span>
                </div>
                <p>{{ task.clienteNombre || 'Cliente sin nombre' }}</p>
              </div>
              <div class="task-meta">
                <span>{{ task.departamentoAsignado }}</span>
                <span>{{ task.estado }}</span>
              </div>
            </article>
          </div>
        </article>
      </section>
    </section>
  `,
  styles: [`
    .dashboard { display: grid; gap: 20px; }
    .hero-card, .stat-card, .panel { background: rgba(255,255,255,.9); border: 1px solid #dbe4f0; border-radius: 24px; box-shadow: 0 18px 40px rgba(15,23,42,.08); }
    .hero-card { padding: 24px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; color: #0f766e; font-weight: 700; }
    .hero-card h2 { margin: 8px 0; font-size: 30px; }
    .hero-card p { margin: 0; color: #475569; max-width: 760px; }
    .primary-btn { border: 0; border-radius: 14px; padding: 12px 18px; background: #0f766e; color: #fff; font-weight: 700; cursor: pointer; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
    .stat-card { padding: 18px 20px; display: grid; gap: 8px; }
    .stat-label { color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
    .stat-value { font-size: clamp(24px, 2.2vw, 36px); line-height: 1; }
    .content-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 16px; }
    .panel { padding: 22px; display: grid; gap: 16px; }
    .panel-heading h3 { margin: 8px 0 0; }
    .use-case-grid, .task-list { display: grid; gap: 12px; }
    .use-case-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .use-case-card, .task-card { border: 1px solid #dbe4f0; border-radius: 18px; padding: 16px; background: #f8fafc; text-align: left; }
    .use-case-card { cursor: pointer; display: grid; gap: 8px; }
    .use-case-id { display: inline-flex; width: fit-content; padding: 6px 10px; border-radius: 999px; background: #ccfbf1; color: #115e59; font-size: 12px; font-weight: 800; }
    .use-case-card strong, .task-card strong { font-size: 16px; }
    .use-case-card p, .task-card p { margin: 0; color: #64748b; }
    .task-card { display: flex; justify-content: space-between; gap: 14px; align-items: center; }
    .task-main, .task-meta { display: grid; gap: 8px; }
    .task-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .task-meta { text-align: right; color: #475569; font-size: 13px; }
    .priority-chip { display: inline-flex; padding: 4px 8px; border-radius: 999px; background: #e2e8f0; color: #334155; font-size: 12px; font-weight: 700; }
    .priority-chip.high { background: #fee2e2; color: #991b1b; }
    .empty-box { color: #64748b; padding: 8px 0; }
    @media (max-width: 1100px) {
      .stats-grid, .use-case-grid, .content-grid { grid-template-columns: 1fr; }
      .hero-card, .task-card { flex-direction: column; align-items: flex-start; }
      .task-meta { text-align: left; }
    }
  `]
})
export class OperatorDashboardComponent implements OnInit {
  tasks: OperatorTask[] = [];

  constructor(
    private workflowService: WorkflowService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.workflowService.getOperatorInbox().subscribe({
      next: tasks => this.tasks = tasks
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

  get overdueCount(): number {
    const now = Date.now();
    return this.tasks.filter(task => task.fechaVencimiento && new Date(task.fechaVencimiento).getTime() < now).length;
  }

  get previewTasks(): OperatorTask[] {
    return this.tasks.slice(0, 6);
  }

  goToInbox(): void {
    this.router.navigate(['/operator/tasks']);
  }

  goToHistory(): void {
    this.router.navigate(['/operator/history']);
  }
}
