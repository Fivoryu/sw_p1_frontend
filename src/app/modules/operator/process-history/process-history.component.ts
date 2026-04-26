import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcessHistoryDetail, ProcessSearchResult } from '../../../shared/models/workflow.model';
import { WorkflowService } from '../../../shared/services/workflow.service';

@Component({
  selector: 'app-process-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">CU-20 · TRAZABILIDAD OPERATIVA</span>
          <h2>Historial y búsqueda de trámites</h2>
          <p>Consulta expedientes por ID, DNI, estado o fechas, y revisa la línea completa de acciones del funcionario.</p>
        </div>
      </header>

      <section class="filter-bar">
        <input [(ngModel)]="filters.workflowInstanceId" placeholder="Buscar por ID de trámite" />
        <input [(ngModel)]="filters.clienteDni" placeholder="Buscar por DNI del cliente" />
        <select [(ngModel)]="filters.estado">
          <option value="">Todos los estados</option>
          <option value="IN_PROGRESS">En proceso</option>
          <option value="COMPLETED">Completado</option>
          <option value="RUNNING">Running</option>
        </select>
        <input [(ngModel)]="filters.fechaDesde" type="date" />
        <input [(ngModel)]="filters.fechaHasta" type="date" />
        <button class="primary-btn" type="button" (click)="search()">Buscar trámite</button>
      </section>

      <div class="content-grid">
        <aside class="instance-list">
          <button
            *ngFor="let item of items"
            class="instance-card"
            [class.selected]="item.instanciaId === selected?.instanciaId"
            (click)="openHistory(item.instanciaId)"
          >
            <div class="instance-top">
              <strong>{{ item.policyName }}</strong>
              <span class="status-chip" [class.success]="item.estado === 'COMPLETED'">{{ item.estado }}</span>
            </div>
            <span>{{ item.instanciaId }}</span>
            <small>{{ item.clienteNombre || 'Cliente' }} · {{ item.departamentoActual || 'Sin departamento' }}</small>
          </button>
        </aside>

        <main class="history-card" *ngIf="selected; else noSelection">
          <header class="history-header">
            <div>
              <h3>{{ selected.policyName }}</h3>
              <p>{{ selected.instanciaId }}</p>
            </div>
            <span class="status-chip" [class.success]="selected.estado === 'COMPLETED'">{{ selected.estado }}</span>
          </header>

          <section>
            <h4>Línea de tiempo</h4>
            <div class="timeline">
              <article *ngFor="let event of selected.historialNodos" class="timeline-item">
                <div class="timeline-top">
                  <strong>{{ event.nodeName || event.taskName || event.nodeId }}</strong>
                  <span class="status-chip" [class.success]="event.status.includes('COMPLETED')">{{ event.status }}</span>
                </div>
                <span>{{ event.timestamp | date:'short' }}</span>
                <small *ngIf="event.errorMessage">{{ event.errorMessage }}</small>
              </article>
            </div>
          </section>

          <section>
            <h4>Formularios completados</h4>
            <div class="form-history" *ngFor="let form of selected.formulariosCompletados">
              <div class="timeline-top">
                <strong>{{ form.formularioId }}</strong>
                <span class="status-chip success">{{ form.estado || 'COMPLETED' }}</span>
              </div>
              <span class="form-meta">{{ form.fecha | date:'short' }} · {{ form.usuarioId }}</span>
              <div *ngFor="let item of objectEntries(form.valores)" class="key-value">
                <span>{{ item.key }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </section>

          <section *ngIf="selected.documentos?.length">
            <h4>Documentos asociados</h4>
            <div class="form-history" *ngFor="let document of selected.documentos">
              <div class="timeline-top">
                <strong>{{ document.nombreArchivo }}</strong>
                <span class="status-chip">{{ document.estado || 'UPLOADED' }}</span>
              </div>
              <span class="form-meta">{{ document.fecha | date:'short' }} · {{ document.mimeType || 'Archivo' }}</span>
            </div>
          </section>
        </main>

        <ng-template #noSelection>
          <section class="empty-box">
            <h3>Selecciona un trámite</h3>
            <p>Usa la búsqueda para localizar un expediente y revisar su trazabilidad completa.</p>
          </section>
        </ng-template>
      </div>

      <p *ngIf="feedback" class="feedback">{{ feedback }}</p>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 18px; }
    .page-header h2 { margin: 8px 0 6px; }
    .page-header p { margin: 0; color: #64748b; }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; color: #0f766e; font-weight: 700; }
    .filter-bar, .instance-list, .history-card, .empty-box { background: rgba(255,255,255,.9); border: 1px solid #dbe4f0; border-radius: 24px; box-shadow: 0 18px 40px rgba(15,23,42,.08); }
    .filter-bar { padding: 16px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)) 180px; gap: 12px; }
    .content-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 20px; }
    .instance-list, .history-card { padding: 18px; }
    .instance-list { display: grid; gap: 12px; align-content: start; }
    .instance-card { text-align: left; border: 1px solid #dbe4f0; border-radius: 16px; background: #f8fafc; padding: 14px; display: grid; gap: 6px; cursor: pointer; }
    .instance-card.selected { border-color: #2563eb; background: #dbeafe; }
    .instance-card span, .instance-card small { color: #64748b; }
    .instance-top, .timeline-top, .history-header { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
    .history-card { display: grid; gap: 18px; }
    .history-header h3 { margin: 0 0 6px; }
    .history-header p { margin: 0; color: #64748b; }
    .status-chip { background: #dbeafe; color: #1d4ed8; border-radius: 999px; padding: 6px 10px; font-weight: 700; height: fit-content; font-size: 12px; }
    .status-chip.success { background: #dcfce7; color: #166534; }
    .timeline, .form-history { display: grid; gap: 10px; }
    .timeline-item, .form-history { border: 1px solid #dbe4f0; border-radius: 16px; padding: 14px; background: #f8fafc; }
    .timeline-item span, .form-meta, .timeline-item small { color: #64748b; font-size: 13px; }
    .key-value { display: flex; justify-content: space-between; gap: 12px; padding-top: 8px; }
    input, select { width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; }
    .primary-btn { border: 0; border-radius: 14px; padding: 11px 16px; background: #0f766e; color: #fff; font-weight: 700; cursor: pointer; }
    .empty-box { padding: 24px; }
    .feedback { margin: 0; color: #0369a1; font-weight: 600; }
    @media (max-width: 1100px) {
      .filter-bar, .content-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ProcessHistoryComponent implements OnInit {
  items: ProcessSearchResult[] = [];
  selected: ProcessHistoryDetail | null = null;
  feedback = '';
  filters = {
    workflowInstanceId: '',
    clienteDni: '',
    estado: '',
    fechaDesde: '',
    fechaHasta: ''
  };

  constructor(
    private workflowService: WorkflowService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.search();
    this.route.queryParamMap.subscribe(params => {
      const instanceId = params.get('instance');
      if (instanceId) {
        this.openHistory(instanceId, false);
      }
    });
  }

  search(): void {
    this.workflowService.searchOperatorProcesses(this.filters).subscribe({
      next: items => {
        this.items = items;
        if (!this.selected && items[0]) {
          this.openHistory(items[0].instanciaId, false);
        }
      },
      error: () => {
        this.feedback = 'No se pudieron buscar los trámites.';
      }
    });
  }

  openHistory(instanceId: string, updateUrl = true): void {
    this.workflowService.getOperatorProcessHistory(instanceId).subscribe({
      next: detail => {
        this.selected = detail;
        if (updateUrl) {
          this.router.navigate([], { relativeTo: this.route, queryParams: { instance: instanceId } });
        }
      },
      error: () => {
        this.feedback = 'No se pudo cargar el historial del trámite.';
      }
    });
  }

  objectEntries(values: Record<string, unknown>): Array<{ key: string; value: string }> {
    return Object.entries(values ?? {}).map(([key, value]) => ({ key, value: String(value) }));
  }
}
