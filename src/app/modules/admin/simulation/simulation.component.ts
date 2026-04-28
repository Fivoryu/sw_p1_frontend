import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WorkflowAiService } from '../../../services/workflow-ai.service';

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h2>Simulación · Cuellos de botella</h2>
          <p>Analiza backlog, vencimientos y antigüedad por nodo a partir de un workflow y un set de tareas.</p>
        </div>
        <div class="actions">
          <button class="btn" type="button" (click)="loadExample()">Cargar ejemplo</button>
          <button class="btn primary" type="button" (click)="run()" [disabled]="loading">Ejecutar</button>
        </div>
      </header>

      <div class="grid">
        <section class="card">
          <h3>Entrada</h3>

          <label>Workflow ID</label>
          <input [(ngModel)]="workflowId" placeholder="Ej: wf-demo-01" />

          <label>SLA (horas)</label>
          <input [(ngModel)]="slaHours" type="number" min="1" />

          <label>Workflow (nodes/flows) · JSON</label>
          <textarea [(ngModel)]="workflowJson" rows="12" placeholder='{"nodes":[{"id":"n1","label":"Inicio"}],"flows":[{"id":"f1","source":"n1","target":"n2"}]}'></textarea>

          <label>Tareas · JSON</label>
          <textarea [(ngModel)]="tasksJson" rows="12" placeholder='[{"id":"t1","node_id":"n2","status":"PENDING","created_at":"2026-01-01T00:00:00Z"}]'></textarea>

          <div class="alert" *ngIf="error">
            <strong>Error:</strong> {{ error }}
          </div>
        </section>

        <section class="card">
          <h3>Resultado</h3>

          <div class="muted" *ngIf="loading">Ejecutando simulación...</div>
          <div class="muted" *ngIf="!loading && !result">Ejecuta la simulación para ver métricas y hallazgos.</div>

          <div *ngIf="result" class="result">
            <div class="summary">
              <div class="kpi">
                <span>Workflow</span>
                <strong>{{ asString(result['workflow_id']) }}</strong>
              </div>
              <div class="kpi">
                <span>Total tareas</span>
                <strong>{{ asString(result['total_tasks']) }}</strong>
              </div>
              <div class="kpi wide">
                <span>Resumen</span>
                <strong>{{ asString(result['summary']) }}</strong>
              </div>
            </div>

            <div class="list" *ngIf="asArray(result['bottlenecks']).length">
              <h4>Cuellos de botella</h4>
              <article class="row" *ngFor="let b of asArray(result['bottlenecks'])">
                <div>
                  <strong>{{ b.node_name || b.node_id }}</strong>
                  <div class="muted small">Pendientes: {{ b.pending_tasks }} · En progreso: {{ b.in_progress_tasks }} · Edad prom: {{ b.average_age_hours }}h</div>
                </div>
                <span class="pill" [class.high]="b.severity==='HIGH'" [class.med]="b.severity==='MEDIUM'">{{ b.severity || 'LOW' }}</span>
              </article>
            </div>

            <div class="list" *ngIf="asArray(result['warnings']).length">
              <h4>Warnings</h4>
              <div class="warn" *ngFor="let w of asArray(result['warnings'])">{{ w }}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .page { display: grid; gap: 16px; }
    .head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 10px 4px; }
    h2 { margin: 0; font-size: 26px; }
    p { margin: 6px 0 0; color: #475569; max-width: 68ch; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
    .card { background: #ffffff; border-radius: 18px; padding: 16px; border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 20px rgba(15,23,42,.05); display: grid; gap: 10px; }
    h3 { margin: 0 0 4px; }
    label { font-size: 13px; color: #334155; font-weight: 800; }
    input, textarea { border: 1px solid rgba(15,23,42,.14); border-radius: 12px; padding: 10px 12px; outline: none; width: 100%; }
    textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; }
    input:focus, textarea:focus { border-color: rgba(37,99,235,.6); box-shadow: 0 0 0 4px rgba(37,99,235,.15); }
    .btn { border: 1px solid rgba(15,23,42,.12); background: #fff; border-radius: 12px; padding: 10px 12px; cursor: pointer; font-weight: 800; }
    .btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .alert { background: #fef2f2; color: #991b1b; border: 1px solid rgba(239,68,68,.25); border-radius: 14px; padding: 12px 14px; }
    .muted { color: #64748b; font-weight: 700; }
    .muted.small { font-size: 12px; font-weight: 600; }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .kpi { padding: 12px; border: 1px solid rgba(15,23,42,.10); border-radius: 16px; background: #f8fafc; display: grid; gap: 4px; }
    .kpi.wide { grid-column: 1 / -1; }
    .kpi span { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; }
    .kpi strong { font-size: 16px; }
    .list { margin-top: 8px; display: grid; gap: 10px; }
    .row { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 12px; border-radius: 16px; border: 1px solid rgba(15,23,42,.10); background: #f8fafc; }
    .pill { display: inline-flex; padding: 6px 10px; border-radius: 999px; font-weight: 900; background: rgba(34,197,94,.12); color: #166534; }
    .pill.med { background: rgba(245,158,11,.16); color: #92400e; }
    .pill.high { background: rgba(239,68,68,.14); color: #991b1b; }
    .warn { padding: 10px 12px; border-radius: 14px; background: #fffbeb; border: 1px solid rgba(245,158,11,.25); color: #92400e; font-weight: 800; }
    @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class SimulationComponent {
  workflowId = 'wf-demo-01';
  slaHours = 48;
  workflowJson = '';
  tasksJson = '';

  loading = false;
  error: string | null = null;
  result: Record<string, unknown> | null = null;

  constructor(private workflowAi: WorkflowAiService) {}

  loadExample(): void {
    this.workflowId = 'wf-demo-01';
    this.slaHours = 48;
    this.workflowJson = JSON.stringify({
      nodes: [
        { id: 'n_start', label: 'Inicio', type: 'START' },
        { id: 'n_rev', label: 'Revisión', type: 'TASK' },
        { id: 'n_apr', label: 'Aprobación', type: 'TASK' },
        { id: 'n_end', label: 'Fin', type: 'END' }
      ],
      flows: [
        { id: 'f1', source: 'n_start', target: 'n_rev' },
        { id: 'f2', source: 'n_rev', target: 'n_apr' },
        { id: 'f3', source: 'n_apr', target: 'n_end' }
      ]
    }, null, 2);

    this.tasksJson = JSON.stringify([
      { id: 't-001', node_id: 'n_rev', status: 'PENDING', created_at: '2026-04-20T10:00:00Z' },
      { id: 't-002', node_id: 'n_rev', status: 'IN_PROGRESS', created_at: '2026-04-21T08:00:00Z' },
      { id: 't-003', node_id: 'n_apr', status: 'PENDING', created_at: '2026-04-22T15:00:00Z' }
    ], null, 2);
  }

  run(): void {
    this.error = null;
    this.result = null;
    this.loading = true;

    try {
      const workflowParsed = JSON.parse(this.workflowJson || '{}') as Record<string, unknown>;
      const nodes = Array.isArray(workflowParsed['nodes']) ? (workflowParsed['nodes'] as Array<Record<string, unknown>>) : [];
      const flows = Array.isArray(workflowParsed['flows']) ? (workflowParsed['flows'] as Array<Record<string, unknown>>) : [];
      const tasksParsed = JSON.parse(this.tasksJson || '[]') as Array<Record<string, unknown>>;

      const payload = {
        workflow: {
          id: this.workflowId,
          nodes,
          flows
        },
        tasks: Array.isArray(tasksParsed) ? tasksParsed : [],
        sla_hours: Number(this.slaHours || 48)
      };

      this.workflowAi.analyzeBottleneck(payload).subscribe({
        next: (res) => {
          this.result = res;
          this.loading = false;
        },
        error: (e) => {
          this.error = e?.error?.message || e?.message || 'No se pudo ejecutar la simulación';
          this.loading = false;
        }
      });
    } catch (e: any) {
      this.error = e?.message || 'JSON inválido';
      this.loading = false;
    }
  }

  asString(value: unknown): string {
    if (value === null || value === undefined) return '—';
    return String(value);
  }

  asArray(value: unknown): any[] {
    return Array.isArray(value) ? value : [];
  }
}

