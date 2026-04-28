import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DynamicFormComponent } from '../dynamic-form/dynamic-form.component';
import { CorrectionTarget, TaskDetail } from '../../../shared/models/workflow.model';
import { WorkflowService } from '../../../shared/services/workflow.service';
import { WorkflowAiService, OcrDocumentResponse } from '../../../services/workflow-ai.service';

@Component({
  selector: 'app-execute-task',
  standalone: true,
  imports: [CommonModule, FormsModule, DynamicFormComponent, RouterLink],
  template: `
    <section class="page" *ngIf="!loading; else loadingState">
      <ng-container *ngIf="taskDetail as detail; else emptyState">
        <header class="page-header">
          <div class="header-copy">
            <span class="eyebrow">CU-16 · EJECUCIÓN DE TRÁMITE</span>
            <h2>{{ detail.tarea.nombreTarea }}</h2>
            <p>
              Trámite {{ detail.tarea.workflowInstanceId }} · {{ detail.tarea.clienteNombre || 'Cliente sin nombre' }}
              · {{ detail.tarea.departamentoAsignado }}
            </p>
          </div>

          <div class="header-actions">
            <span class="status-chip" [class.locked]="detail.accessState === 'BLOCKED_BY_OTHER'" [class.claim]="detail.accessState === 'PENDING_CLAIM'">
              {{ accessStateLabel(detail.accessState) }}
            </span>
            <span class="priority-chip" [class.high]="detail.tarea.prioridad === 'HIGH'" [class.medium]="detail.tarea.prioridad === 'MEDIUM'">
              {{ detail.tarea.prioridad || 'NORMAL' }}
            </span>
            <button class="secondary-btn" type="button" [routerLink]="['/operator/history']" [queryParams]="{ instance: detail.tarea.workflowInstanceId }">
              Ver historial
            </button>
          </div>
        </header>

        <section class="hero-strip">
          <article class="hero-card">
            <span>Estado tarea</span>
            <strong>{{ detail.tarea.estado }}</strong>
          </article>
          <article class="hero-card">
            <span>Responsable</span>
            <strong>{{ detail.tarea.usuarioAsignado || 'Sin reclamar' }}</strong>
          </article>
          <article class="hero-card">
            <span>Vencimiento</span>
            <strong>{{ detail.tarea.fechaVencimiento ? (detail.tarea.fechaVencimiento | date:'short') : 'Sin fecha' }}</strong>
          </article>
          <article class="hero-card">
            <span>Cliente</span>
            <strong>{{ detail.tarea.clienteDni || 'Sin documento' }}</strong>
          </article>
        </section>

        <div class="layout">
          <aside class="progress-panel">
            <section class="panel-section">
              <h3>Progreso del workflow</h3>
              <ul class="node-list">
                <li *ngFor="let node of workflowNodes()" [class.active]="isActive(node.id)" [class.completed]="isCompleted(node.id)">
                  <strong>{{ node.name || node.id }}</strong>
                  <span>{{ node.type }}</span>
                </li>
              </ul>
            </section>

            <section class="panel-section">
              <h3>Datos del trámite</h3>
              <div class="summary-box">
                <div *ngFor="let entry of contextEntries(detail.datosActuales)" class="summary-entry">
                  <span>{{ entry.key }}</span>
                  <strong>{{ entry.value }}</strong>
                </div>
              </div>
            </section>

            <section class="panel-section" *ngIf="detail.documentos?.length">
              <h3>Documentos adjuntos</h3>
              <article *ngFor="let document of detail.documentos" class="document-row">
                <div>
                  <strong>{{ document.nombreArchivo }}</strong>
                  <span>{{ document.mimeType || 'Archivo' }}</span>
                </div>
                <span class="mini-chip">{{ document.estado || 'UPLOADED' }}</span>
              </article>
            </section>

            <section class="panel-section">
              <h3>OCR (texto)</h3>
              <p class="muted">Pega el texto del documento (demo) para extraer campos y prellenar el formulario.</p>
              <textarea class="ocr-text" [(ngModel)]="ocrTextHint" rows="6" placeholder="DNI: 12345678&#10;Nombre: Juan Pérez&#10;Monto: 10000"></textarea>
              <button class="secondary-btn" type="button" (click)="runOcr()" [disabled]="ocrLoading || !ocrTextHint.trim()">
                {{ ocrLoading ? 'Analizando...' : 'Ejecutar OCR' }}
              </button>
              <div *ngIf="ocrResult" class="ocr-result">
                <span class="muted">Tipo: <strong>{{ ocrResult.document_type }}</strong> · Confianza: <strong>{{ ocrResult.confidence }}</strong></span>
                <div class="summary-box" *ngIf="ocrFieldsEntries().length">
                  <div class="summary-entry" *ngFor="let entry of ocrFieldsEntries()">
                    <span>{{ entry.key }}</span>
                    <strong>{{ entry.value }}</strong>
                  </div>
                </div>
                <button class="primary-btn" type="button" (click)="applyOcrToForm()" [disabled]="!ocrFieldsEntries().length">Aplicar al formulario</button>
              </div>
            </section>
          </aside>

          <main class="form-panel">
            <section class="form-shell">
              <header class="panel-top">
                <div>
                  <h3>{{ detail.formulario?.name || 'Formulario de la tarea' }}</h3>
                  <p>{{ readonlyMessage(detail) }}</p>
                </div>
                <div class="action-group">
                  <button class="primary-btn" type="button" *ngIf="detail.canClaim" (click)="claimCurrentTask()">Reclamar tarea</button>
                  <button class="secondary-btn" type="button" [disabled]="!detail.canEdit" (click)="saveDraft()">Guardar borrador</button>
                </div>
              </header>

              <app-dynamic-form
                [form]="detail.formulario ?? null"
                [(value)]="formValues"
                [readonly]="!detail.canEdit || detail.accessState === 'BLOCKED_BY_OTHER'"
              ></app-dynamic-form>

              <section class="readonly-section" *ngIf="detail.formulariosPrevios?.length">
                <h4>Formularios previos</h4>
                <article *ngFor="let previous of detail.formulariosPrevios" class="previous-form-card">
                  <div class="previous-top">
                    <strong>{{ previous.formularioId }}</strong>
                    <span class="mini-chip success">{{ previous.estado }}</span>
                  </div>
                  <span class="muted">{{ previous.fecha | date:'short' }} · {{ previous.usuarioId }}</span>
                  <div *ngFor="let item of contextEntries(previous.valores)" class="summary-entry compact">
                    <span>{{ item.key }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </article>
              </section>

              <section class="correction-box">
                <h4>Solicitar corrección</h4>
                <label class="target-label" *ngIf="correctionTargets.length">Devolver a</label>
                <select class="target-select" *ngIf="correctionTargets.length" [(ngModel)]="correctionTargetNodeId">
                  <option value="">Último paso humano previo</option>
                  <option *ngFor="let target of correctionTargets" [value]="target.nodeId">
                    {{ target.nodeName || target.nodeId }} ({{ target.nodeType || 'UserTask' }})
                  </option>
                </select>
                <textarea [(ngModel)]="correctionReason" rows="3" placeholder="Describe por qué este trámite debe volver a un paso anterior"></textarea>
              </section>

              <div class="actions">
                <button class="warning-btn" type="button" [disabled]="!detail.canEdit || !correctionReason.trim()" (click)="requestCorrection()">Solicitar corrección</button>
                <button class="primary-btn" type="button" [disabled]="!detail.canEdit || !isCurrentFormValid(detail)" (click)="derivar()">Derivar trámite</button>
              </div>
            </section>
          </main>
        </div>

        <p *ngIf="feedback" class="feedback">{{ feedback }}</p>
      </ng-container>

      <ng-template #emptyState>
        <section class="empty-shell">
          <h3>No se pudo abrir la tarea</h3>
          <p>{{ feedback || 'Esta tarea no existe, ya no está disponible o no pertenece a tu departamento.' }}</p>
          <a routerLink="/operator/tasks" class="link-btn">Volver a la bandeja</a>
        </section>
      </ng-template>
    </section>

    <ng-template #loadingState>
      <section class="loading-shell">
        <h3>Cargando expediente operativo...</h3>
        <p>Estamos reconstruyendo la tarea y su contexto para que puedas trabajarla desde esta URL.</p>
      </section>
    </ng-template>
  `,
  styles: [`
    .page { display: grid; gap: 18px; }
    .page-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: 11px; color: #0f766e; font-weight: 800; }
    .header-copy h2 { margin: 8px 0 6px; font-size: 30px; }
    .header-copy p { margin: 0; color: #64748b; }
    .header-actions, .action-group, .actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .hero-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .hero-card, .progress-panel, .form-shell, .empty-shell, .loading-shell { border: 1px solid #dbe4f0; border-radius: 24px; background: rgba(255,255,255,.94); box-shadow: 0 18px 40px rgba(15,23,42,.08); }
    .hero-card { padding: 16px 18px; display: grid; gap: 8px; }
    .hero-card span { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .hero-card strong { font-size: 22px; }
    .layout { display: grid; grid-template-columns: minmax(320px, 32%) minmax(0, 1fr); gap: 20px; }
    .progress-panel, .form-shell { padding: 20px; display: grid; gap: 18px; }
    .panel-section { display: grid; gap: 12px; }
    .node-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .node-list li { padding: 12px 14px; border-radius: 16px; border: 1px solid #dbe4f0; background: #f8fafc; display: grid; gap: 4px; }
    .node-list li.active { background: #dbeafe; border-color: #2563eb; }
    .node-list li.completed { background: #dcfce7; border-color: #16a34a; }
    .node-list span, .muted { color: #64748b; font-size: 12px; }
    .summary-box, .readonly-section { display: grid; gap: 10px; }
    .summary-entry { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 12px; background: #f8fafc; }
    .summary-entry.compact { padding: 8px 10px; }
    .panel-top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .panel-top h3 { margin: 0 0 6px; font-size: 24px; }
    .panel-top p { margin: 0; color: #64748b; }
    .readonly-section h4, .correction-box h4 { margin: 0; }
    .previous-form-card, .correction-box { border: 1px solid #dbe4f0; border-radius: 18px; padding: 14px; background: #f8fafc; display: grid; gap: 10px; }
    .target-label { font-size: 12px; font-weight: 800; color: #334155; }
    .target-select { width: 100%; border: 1px solid #cbd5e1; border-radius: 14px; padding: 10px 12px; background: #fff; }
    .previous-top, .document-row { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
    .document-row { padding: 10px 12px; border-radius: 14px; background: #f8fafc; }
    .document-row div { display: grid; }
    .correction-box textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 14px; padding: 12px; resize: vertical; }
    .ocr-text { width: 100%; border: 1px solid #cbd5e1; border-radius: 14px; padding: 12px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; }
    .ocr-result { display: grid; gap: 10px; }
    .status-chip, .priority-chip, .mini-chip { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 700; }
    .status-chip { background: #dbeafe; color: #1d4ed8; }
    .status-chip.claim { background: #ffedd5; color: #9a3412; }
    .status-chip.locked { background: #fee2e2; color: #991b1b; }
    .priority-chip { background: #e2e8f0; color: #334155; }
    .priority-chip.high { background: #fee2e2; color: #991b1b; }
    .priority-chip.medium { background: #ffedd5; color: #9a3412; }
    .mini-chip { background: #e2e8f0; color: #334155; }
    .mini-chip.success { background: #dcfce7; color: #166534; }
    .primary-btn, .secondary-btn, .warning-btn, .link-btn { border: 0; border-radius: 14px; padding: 11px 16px; font-weight: 700; cursor: pointer; text-decoration: none; }
    .primary-btn { background: #0f766e; color: #fff; }
    .secondary-btn, .link-btn { background: #e2e8f0; color: #0f172a; }
    .warning-btn { background: #f59e0b; color: #1f2937; }
    .feedback { margin: 0; color: #0369a1; font-weight: 600; }
    .empty-shell, .loading-shell { padding: 28px; }
    .empty-shell h3, .loading-shell h3 { margin: 0 0 8px; }
    .empty-shell p, .loading-shell p { margin: 0 0 16px; color: #64748b; }
    @media (max-width: 1100px) {
      .hero-strip, .layout { grid-template-columns: 1fr; }
    }
  `]
})
export class ExecuteTaskComponent implements OnInit {
  taskDetail: TaskDetail | null = null;
  formValues: Record<string, unknown> = {};
  correctionReason = '';
  correctionTargets: CorrectionTarget[] = [];
  correctionTargetNodeId = '';
  ocrTextHint = '';
  ocrLoading = false;
  ocrResult: OcrDocumentResponse | null = null;
  feedback = '';
  loading = true;

  constructor(
    private workflowService: WorkflowService,
    private workflowAiService: WorkflowAiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const navigation = this.router.getCurrentNavigation();
    const historyState = window.history.state as { taskDetail?: TaskDetail } | null;
    const detail = (navigation?.extras.state?.['taskDetail'] as TaskDetail | undefined)
      ?? historyState?.taskDetail;
    if (detail) {
      this.applyDetail(detail);
      this.loadCorrectionTargets(detail.tarea.id);
    }

    this.route.paramMap.subscribe(params => {
      const taskId = params.get('id');
      if (!taskId) {
        this.loading = false;
        this.feedback = 'No se recibió el identificador de la tarea.';
        return;
      }
      if (!this.taskDetail || this.taskDetail.tarea.id !== taskId) {
        this.loadTask(taskId);
      } else {
        this.loading = false;
      }
    });
  }

  workflowNodes(): Array<{ id: string; name?: string; type: string }> {
    return Object.values(this.taskDetail?.workflowGraph ?? {}) as Array<{ id: string; name?: string; type: string }>;
  }

  isActive(nodeId: string): boolean {
    return this.taskDetail?.activeNodeIds?.includes(nodeId) ?? false;
  }

  isCompleted(nodeId: string): boolean {
    return (this.taskDetail?.tramite.history ?? []).some(entry => entry.nodeId === nodeId && entry.status?.includes('COMPLETED'));
  }

  contextEntries(source: Record<string, unknown> | undefined): Array<{ key: string; value: string }> {
    return Object.entries(source ?? {})
      .slice(0, 8)
      .map(([key, value]) => ({ key, value: String(value) }));
  }

  accessStateLabel(state?: string): string {
    switch (state) {
      case 'PENDING_CLAIM':
        return 'Pendiente de reclamo';
      case 'IN_PROGRESS_BY_YOU':
        return 'En proceso por ti';
      case 'BLOCKED_BY_OTHER':
        return 'Bloqueada por otro funcionario';
      default:
        return 'Disponible';
    }
  }

  readonlyMessage(detail: TaskDetail): string {
    if (detail.accessState === 'BLOCKED_BY_OTHER') {
      return 'Esta tarea ya está siendo trabajada por otro funcionario.';
    }
    if (detail.canClaim) {
      return 'Puedes empezar a llenar el formulario ahora. Si guardas, corriges o derivas, la tarea se reclamará automáticamente para ti.';
    }
    return 'Completa el formulario, guarda borrador si lo necesitas y deriva el trámite cuando esté listo.';
  }

  claimCurrentTask(): void {
    if (!this.taskDetail) {
      return;
    }
    this.workflowService.claimOperatorTask(this.taskDetail.tarea.id).subscribe({
      next: detail => {
        this.applyDetail(detail);
        this.feedback = 'Tarea reclamada correctamente. Ya puedes trabajar el expediente.';
      },
      error: error => {
        this.feedback = error.error?.message ?? 'No se pudo reclamar la tarea.';
      }
    });
  }

  saveDraft(): void {
    if (!this.taskDetail) {
      return;
    }
    this.workflowService.saveOperatorTaskDraft(this.taskDetail.tarea.id, this.formValues).subscribe({
      next: result => {
        this.applyDetail(result.detalle);
        this.feedback = result.message;
      },
      error: error => {
        this.feedback = error.error?.message ?? 'No se pudo guardar el borrador.';
      }
    });
  }

  requestCorrection(): void {
    if (!this.taskDetail) {
      return;
    }
    const motivo = this.correctionReason.trim();
    if (!motivo) {
      this.feedback = 'Debes ingresar un motivo para solicitar la corrección.';
      return;
    }
    const targetNodeId = this.correctionTargetNodeId?.trim() || null;
    this.workflowService.requestOperatorTaskCorrectionTo(this.taskDetail.tarea.id, motivo, targetNodeId).subscribe({
      next: result => {
        this.feedback = `${result.message}. Devuelto a ${result.nodoDevueltoNombre}.`;
        this.router.navigate(['/operator/history'], { queryParams: { instance: result.instanciaId } });
      },
      error: error => {
        this.feedback = error.error?.message ?? 'No se pudo solicitar la corrección.';
      }
    });
  }

  derivar(): void {
    if (!this.taskDetail) {
      return;
    }
    const missingFields = this.missingRequiredFields(this.taskDetail);
    if (missingFields.length) {
      this.feedback = `Completa los campos obligatorios antes de derivar: ${missingFields.join(', ')}.`;
      return;
    }
    this.workflowService.completeOperatorTask(this.taskDetail.tarea.id, this.formValues).subscribe({
      next: result => {
        this.feedback = result.message;
        this.router.navigate(['/operator/history'], { queryParams: { instance: this.taskDetail?.tarea.workflowInstanceId } });
      },
      error: error => {
        this.feedback = error.error?.message ?? 'No se pudo completar la tarea.';
      }
    });
  }

  isCurrentFormValid(detail: TaskDetail): boolean {
    return this.missingRequiredFields(detail).length === 0;
  }

  private missingRequiredFields(detail: TaskDetail): string[] {
    return (detail.formulario?.fields ?? [])
      .filter(field => field.required)
      .filter(field => {
        const value = this.formValues[field.name];
        if (field.type === 'checkbox') {
          return value !== true;
        }
        return value === undefined || value === null || String(value).trim() === '';
      })
      .map(field => field.label);
  }

  private loadTask(taskId: string): void {
    this.loading = true;
    this.workflowService.getOperatorTaskDetail(taskId).subscribe({
      next: detail => {
        this.applyDetail(detail);
        this.loadCorrectionTargets(detail.tarea.id);
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.taskDetail = null;
        this.feedback = error.error?.message
          ?? (error.status === 404
            ? 'El backend todavía no expone el detalle por URL directa. Reinicia el backend para habilitar esta vista.'
            : 'No se pudo cargar el detalle de la tarea.');
      }
    });
  }

  private applyDetail(detail: TaskDetail): void {
    this.taskDetail = detail;
    this.formValues = {
      ...(detail.datosActuales ?? {}),
      ...(detail.borradorActual ?? {})
    };
    // targets se recalculan por tarea; reset selección por seguridad
    this.correctionTargets = [];
    this.correctionTargetNodeId = '';
    // OCR es asistido por texto y depende del contexto actual
    this.ocrTextHint = '';
    this.ocrResult = null;
    this.ocrLoading = false;
    this.loading = false;
  }

  private loadCorrectionTargets(taskId: string): void {
    this.workflowService.listOperatorCorrectionTargets(taskId).subscribe({
      next: targets => {
        this.correctionTargets = targets ?? [];
      },
      error: () => {
        this.correctionTargets = [];
      }
    });
  }

  runOcr(): void {
    if (!this.ocrTextHint.trim()) return;
    this.ocrLoading = true;
    this.ocrResult = null;
    this.workflowAiService.extractDocument(this.ocrTextHint).subscribe({
      next: res => {
        this.ocrResult = res;
        this.ocrLoading = false;
        if (res.warnings?.length) {
          this.feedback = res.warnings.join(' | ');
        }
      },
      error: err => {
        this.ocrLoading = false;
        this.feedback = err?.error?.message ?? 'No se pudo ejecutar OCR';
      }
    });
  }

  ocrFieldsEntries(): Array<{ key: string; value: string }> {
    const fields = this.ocrResult?.extracted_data?.fields ?? {};
    if (!fields || typeof fields !== 'object') return [];
    return Object.entries(fields)
      .slice(0, 10)
      .map(([key, value]) => ({ key, value: String(value) }));
  }

  applyOcrToForm(): void {
    const fields = this.ocrResult?.extracted_data?.fields ?? null;
    if (!fields || typeof fields !== 'object') return;
    this.formValues = { ...this.formValues, ...(fields as Record<string, unknown>) };
    this.feedback = 'Campos OCR aplicados al formulario. Revisa y guarda/deriva cuando corresponda.';
  }
}
