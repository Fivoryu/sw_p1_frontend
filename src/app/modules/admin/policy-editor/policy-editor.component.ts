import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import Modeler from 'bpmn-js/lib/Modeler';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { DepartmentService } from '../../../services/department.service';
import {
  CreatePolicyRequest,
  DiagramGenerationResponse,
  GeneratedDiagramFlow,
  GeneratedDiagramNode,
  PolicyService
} from '../../../services/policy.service';
import {
  DepartmentDefinition,
  FormDefinition,
  FormFieldDefinition,
  Policy
} from '../../../shared/models/workflow.model';
import { runtimeConfig } from '../../../shared/config/runtime-config';

type CollaborationMode = 'PRIVATE' | 'READ_ONLY' | 'EDIT_SHARED';
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface TaskBinding {
  taskId: string;
  taskName: string;
  departmentRole: string;
  formId: string;
}

interface FieldPaletteItem {
  label: string;
  description: string;
  type: FormFieldDefinition['type'];
}

interface CollaborationMessage {
  type: 'STATE_SYNC' | 'PRESENCE' | 'MODE_CHANGED' | 'AUTOSAVE_ACK' | 'ERROR' | string;
  policyId: string;
  actor: string;
  actorDisplayName: string;
  actorUserId?: string;
  ownerUserId?: string;
  ownerDisplayName?: string;
  empresa?: string;
  collaborationEnabled?: boolean;
  collaborationMode?: CollaborationMode | string;
  canEdit?: boolean;
  policyName?: string;
  name: string;
  description: string;
  bpmnXml: string;
  forms: FormDefinition[];
  taskBindings: TaskBinding[];
  timestamp: number;
}

@Component({
  selector: 'app-policy-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="editor-page">
      <div class="page-nav">
        <a routerLink="/admin/dashboard" class="back-link">← Volver al dashboard</a>
        <a routerLink="/admin/departments" class="back-link secondary-link">Gestionar departamentos</a>
      </div>

      <header class="page-header">
        <div>
          <p class="eyebrow">CU-07 / CU-08 · WORKFLOW</p>
          <h2>Diseñar Política de Negocio</h2>
          <p class="subtitle">
            Modela el flujo, configura formularios y controla si otros administradores de tu empresa pueden observar o editar en vivo.
          </p>
          <div class="status-row">
            <span class="badge" [class.shared]="collaborationEnabled" [class.private]="!collaborationEnabled">
              {{ collaborationModeLabel }}
            </span>
            <span class="save-status" [class.saving]="saveStatus === 'saving'" [class.error]="saveStatus === 'error'">
              {{ saveStatusLabel }}
            </span>
            <span class="presence" *ngIf="ownerDisplayName">Dueño: {{ ownerDisplayName }}</span>
          </div>
          <p class="selected-policy" *ngIf="selectedPolicy">{{ selectedPolicyHeadline }}</p>
          <div class="metrics-row">
            <article class="metric-card">
              <span>Políticas</span>
              <strong>{{ policies.length }}</strong>
            </article>
            <article class="metric-card">
              <span>Formularios</span>
              <strong>{{ forms.length }}</strong>
            </article>
            <article class="metric-card">
              <span>Campos</span>
              <strong>{{ totalFieldCount }}</strong>
            </article>
          </div>
          <p class="collaboration-note">{{ collaborationStatus }}</p>
        </div>
        <div class="header-actions">
          <button class="secondary" type="button" (click)="resetWorkspace()">Nueva política</button>
          <button class="primary" type="button" [disabled]="!canEditCurrentPolicy" (click)="savePolicy()">Guardar ahora</button>
          <button class="primary" type="button" [disabled]="!selectedPolicy || !canEditCurrentPolicy" (click)="publishPolicy()">Publicar</button>
          <button
            class="danger"
            type="button"
            [disabled]="!selectedPolicy || !canDeleteSelectedPolicy || deleteInProgress"
            (click)="confirmDeletePolicy()"
          >
            {{ deleteInProgress ? 'Eliminando...' : 'Eliminar política' }}
          </button>
        </div>
      </header>

      <div class="workspace">
        <aside class="sidebar">
          <section class="panel">
            <div class="panel-header">
              <h3>Políticas</h3>
              <button class="ghost" type="button" (click)="loadPolicies()">Actualizar</button>
            </div>

            <input
              class="search-input"
              [ngModel]="policySearch"
              (ngModelChange)="policySearch = $event"
              placeholder="Buscar política"
            />

            <button class="primary block" type="button" (click)="resetWorkspace()">Nueva política</button>

            <div class="scroll-list">
              <button
                *ngFor="let policy of filteredPolicies"
                class="list-item"
                [class.selected]="policy.id === selectedPolicy?.id"
                type="button"
                (click)="selectPolicy(policy)"
              >
                <div class="list-item-top">
                  <strong>{{ policy.name }}</strong>
                  <span class="policy-badge" [class.shared]="policy.collaborationEnabled" [class.private]="!policy.collaborationEnabled">
                    {{ policyBadge(policy) }}
                  </span>
                </div>
                <span>{{ policy.status }} · v{{ policy.version }}</span>
              </button>
            </div>
          </section>

          <section class="panel compact-panel">
            <h3>Modo compartido</h3>
            <label class="toggle-row">
              <span>Modo compartido</span>
              <input
                type="checkbox"
                [checked]="collaborationEnabled"
                [disabled]="!canManageCollaboration"
                (change)="toggleSharedMode($event)"
              />
            </label>

            <label class="stacked-field">
              <span>Acceso de colaboradores</span>
              <select
                [ngModel]="collaborationMode"
                [disabled]="!collaborationEnabled || !canManageCollaboration"
                (ngModelChange)="changeCollaborationMode($event)"
              >
                <option value="READ_ONLY">Solo lectura</option>
                <option value="EDIT_SHARED">Edición compartida</option>
              </select>
            </label>

            <p class="helper-copy">
              {{ collaborationHint }}
            </p>
          </section>
        </aside>

        <main class="editor-main">
          <section class="panel ai-panel">
            <div class="split-header">
              <div>
                <span class="eyebrow">CU-12 · IA</span>
                <h3>Generar diagrama por prompt</h3>
                <p class="section-help">
                  Describe el trámite en lenguaje natural o usa dictado por voz. El resultado reemplaza el diagrama del borrador actual.
                </p>
              </div>
              <span class="ai-status" [class.listening]="aiListening" [class.loading]="aiGenerating">
                {{ aiStatusLabel }}
              </span>
            </div>

            <div class="ai-grid">
              <label class="stacked-field ai-prompt">
                <span>Descripción del flujo</span>
                <textarea
                  [(ngModel)]="aiPrompt"
                  [disabled]="!canEditCurrentPolicy || aiGenerating"
                  rows="4"
                  placeholder="Ej. Registrar solicitud, validar documentos, si falta información solicitar corrección, si está completo enviar a evaluación y cerrar."
                ></textarea>
              </label>

              <label class="stacked-field">
                <span>Contexto de negocio opcional</span>
                <textarea
                  [(ngModel)]="aiBusinessContext"
                  [disabled]="!canEditCurrentPolicy || aiGenerating"
                  rows="4"
                  placeholder="Ej. Política de crédito, onboarding digital, actualización documental..."
                ></textarea>
              </label>
            </div>

            <div class="ai-actions">
              <button class="secondary" type="button" [disabled]="!speechSupported || aiListening || !canEditCurrentPolicy" (click)="startVoicePrompt()">
                Dictar por voz
              </button>
              <button class="secondary" type="button" [disabled]="!aiPrompt.trim() || aiGenerating" (click)="clearAiPrompt()">
                Limpiar prompt
              </button>
              <button class="primary" type="button" [disabled]="!canGenerateWithAi" (click)="generateDiagramFromAi()">
                {{ aiGenerating ? 'Generando...' : 'Generar y aplicar diagrama' }}
              </button>
            </div>

            <div class="ai-result" *ngIf="aiDetectedSteps.length || aiWarnings.length">
              <div *ngIf="aiDetectedSteps.length">
                <strong>Pasos detectados</strong>
                <ol>
                  <li *ngFor="let step of aiDetectedSteps">{{ step }}</li>
                </ol>
              </div>
              <div *ngIf="aiWarnings.length">
                <strong>Advertencias</strong>
                <ul>
                  <li *ngFor="let warning of aiWarnings">{{ warning }}</li>
                </ul>
              </div>
            </div>
          </section>

          <section class="panel editor-panel">
            <div class="policy-meta">
              <input
                [(ngModel)]="name"
                [disabled]="!canEditCurrentPolicy"
                (ngModelChange)="markDirty()"
                placeholder="Nombre de la política"
              />
              <input
                [(ngModel)]="description"
                [disabled]="!canEditCurrentPolicy"
                (ngModelChange)="markDirty()"
                placeholder="Descripción"
              />
            </div>

            <div class="editor-actions">
              <button class="secondary" type="button" [disabled]="!canEditCurrentPolicy" (click)="refreshTaskBindings()">Sincronizar tareas</button>
              <button class="secondary" type="button" (click)="exportXml()">Exportar XML</button>
            </div>

            <div class="canvas-wrapper" [class.read-only]="!canEditCurrentPolicy">
              <div #canvas class="canvas"></div>
              <div class="canvas-overlay" *ngIf="!canEditCurrentPolicy">
                <strong>Solo lectura</strong>
                <span>El dueño de esta política te permite verla en tiempo real, pero no editarla.</span>
              </div>
            </div>

            <textarea class="xml-preview" [ngModel]="xmlPreview" rows="8" readonly></textarea>
            <p class="feedback" *ngIf="feedback">{{ feedback }}</p>
          </section>

          <section class="panel forms-panel">
            <div class="split-header">
              <div>
                <h3>Formularios</h3>
                <p class="section-help">Crea formularios dinámicos y asígnalos a las tareas humanas del flujo.</p>
              </div>
              <button class="secondary" type="button" [disabled]="!canEditCurrentPolicy" (click)="addForm()">Nuevo formulario</button>
            </div>

            <div class="forms-list forms-tabs">
              <button
                *ngFor="let form of forms"
                class="list-item"
                [class.selected]="form.id === selectedFormId"
                type="button"
                (click)="selectForm(form.id)"
              >
                <strong>{{ form.name }}</strong>
                <span>{{ form.fields.length }} campos</span>
              </button>
            </div>

            <div class="empty-state" *ngIf="!selectedForm">
              Crea o selecciona un formulario para editar su estructura.
            </div>

            <div class="form-builder" *ngIf="selectedForm">
              <div class="form-meta-card">
                <input
                  [(ngModel)]="selectedForm.name"
                  [disabled]="!canEditCurrentPolicy"
                  (ngModelChange)="markDirty()"
                  placeholder="Nombre del formulario"
                />
                <input
                  [(ngModel)]="selectedForm.description"
                  [disabled]="!canEditCurrentPolicy"
                  (ngModelChange)="markDirty()"
                  placeholder="Descripción"
                />
              </div>

              <div class="form-builder-layout">
                <aside class="field-palette">
                  <div class="palette-header">
                    <h4>Tipos de campo</h4>
                    <span>Haz clic para agregar un campo al formulario</span>
                  </div>

                  <button
                    *ngFor="let item of fieldPalette"
                    class="palette-item"
                    type="button"
                    [disabled]="!canEditCurrentPolicy"
                    (click)="addField(item.type)"
                  >
                    <strong>{{ item.label }}</strong>
                    <span>{{ item.description }}</span>
                  </button>
                </aside>

                <div class="fields">
                  <div *ngIf="!selectedForm.fields.length" class="empty-state">
                    Este formulario aún no tiene campos. Elige un tipo desde la izquierda para empezar.
                  </div>

                  <div *ngFor="let field of selectedForm.fields; let i = index" class="field-card">
                    <div class="field-card-header">
                      <strong>{{ field.label || 'Campo nuevo' }}</strong>
                      <span>{{ field.type }}</span>
                    </div>

                    <div class="field-grid">
                      <input
                        [(ngModel)]="field.label"
                        [disabled]="!canEditCurrentPolicy"
                        (ngModelChange)="markDirty()"
                        placeholder="Etiqueta visible"
                      />
                      <input
                        [(ngModel)]="field.name"
                        [disabled]="!canEditCurrentPolicy"
                        (ngModelChange)="markDirty()"
                        placeholder="Nombre técnico"
                      />
                    </div>

                    <div class="field-grid compact-grid">
                      <select [(ngModel)]="field.type" [disabled]="!canEditCurrentPolicy" (ngModelChange)="markDirty()">
                        <option value="text">Texto</option>
                        <option value="number">Número</option>
                        <option value="date">Fecha</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Selector</option>
                        <option value="checkbox">Checkbox</option>
                      </select>

                      <label class="checkbox-row">
                        <input type="checkbox" [(ngModel)]="field.required" [disabled]="!canEditCurrentPolicy" (ngModelChange)="markDirty()" />
                        Requerido
                      </label>
                    </div>

                    <textarea
                      *ngIf="field.type === 'select'"
                      [ngModel]="serializeOptions(field)"
                      [disabled]="!canEditCurrentPolicy"
                      (ngModelChange)="updateFieldOptions(field, $event)"
                      rows="3"
                      placeholder="Opciones, una por línea"
                    ></textarea>

                    <button class="danger" type="button" [disabled]="!canEditCurrentPolicy" (click)="removeField(i)">Quitar campo</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside class="sidebar right-sidebar">
          <section class="panel">
            <h3>Tareas humanas</h3>
            <input
              class="search-input"
              [ngModel]="taskSearch"
              (ngModelChange)="taskSearch = $event"
              placeholder="Buscar tarea, rol o formulario"
            />
            <div class="scroll-list">
              <button
                *ngFor="let binding of filteredTaskBindings"
                class="list-item"
                [class.selected]="binding.taskId === selectedTaskId"
                type="button"
                (click)="selectTask(binding.taskId)"
              >
                <strong>{{ binding.taskName }}</strong>
                <span>{{ binding.departmentRole || 'Sin departamento' }} · {{ resolveFormName(binding.formId) }}</span>
              </button>
            </div>
          </section>

          <section class="panel" *ngIf="selectedTaskBinding">
            <div class="panel-header">
              <h3>Configurar tarea</h3>
              <button class="ghost" type="button" (click)="focusTaskOnCanvas()">Ir al nodo</button>
            </div>

            <label class="stacked-field">
              <span>Departamento responsable</span>
              <select
                [(ngModel)]="selectedTaskBinding.departmentRole"
                [disabled]="!canEditCurrentPolicy"
                (ngModelChange)="markDirty()"
              >
                <option value="">Selecciona un departamento</option>
                <option *ngFor="let department of departments" [value]="department.role">{{ department.name }}</option>
              </select>
            </label>

            <label class="stacked-field">
              <span>Formulario asociado</span>
              <select
                [(ngModel)]="selectedTaskBinding.formId"
                [disabled]="!canEditCurrentPolicy"
                (ngModelChange)="markDirty()"
              >
                <option value="">Sin formulario</option>
                <option *ngFor="let form of forms" [value]="form.id">{{ form.name }}</option>
              </select>
            </label>

            <p class="helper-copy">
              Esta configuración le indica al motor qué formulario mostrar y a qué departamento derivar la tarea.
            </p>
          </section>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    * { box-sizing: border-box; }
    .editor-page { display: grid; gap: 1rem; }
    .page-nav { display: flex; gap: 1rem; align-items: center; }
    .back-link { color: #1d4ed8; text-decoration: none; font-weight: 600; }
    .secondary-link { color: #0f766e; }
    .page-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding: 1.4rem 1.6rem; border: 1px solid #dbe4f0; border-radius: 28px; background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%); box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08); }
    .eyebrow { margin: 0 0 0.4rem; font-size: 0.75rem; letter-spacing: 0.18em; color: #0f766e; font-weight: 800; }
    h2, h3, h4, p { margin: 0; }
    .subtitle { margin-top: 0.4rem; color: #52607a; max-width: 60rem; }
    .status-row { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.9rem; align-items: center; }
    .metrics-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; margin-top: 0.9rem; max-width: 30rem; }
    .metric-card { border: 1px solid #dbe4f0; border-radius: 14px; padding: 0.55rem 0.7rem; background: #f8fbff; display: grid; gap: 0.15rem; }
    .metric-card span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; }
    .metric-card strong { font-size: 1.05rem; color: #0f172a; }
    .badge, .policy-badge, .save-status { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.32rem 0.8rem; font-size: 0.78rem; font-weight: 700; }
    .badge.private, .policy-badge.private { background: #eef2ff; color: #4338ca; }
    .badge.shared, .policy-badge.shared { background: #dcfce7; color: #166534; }
    .save-status { background: #e2e8f0; color: #0f172a; }
    .save-status.saving { background: #dbeafe; color: #1d4ed8; }
    .save-status.error { background: #fee2e2; color: #b91c1c; }
    .presence { color: #52607a; font-size: 0.84rem; }
    .selected-policy { margin-top: 0.55rem; color: #0f172a; font-weight: 750; }
    .collaboration-note { margin-top: 0.65rem; color: #52607a; }
    .header-actions { display: flex; gap: 0.75rem; align-items: center; justify-content: flex-end; flex-wrap: wrap; flex: 0 0 auto; max-width: 22rem; }
    .header-actions button { min-width: 8.2rem; }
    .workspace { display: grid; grid-template-columns: 260px minmax(680px, 1fr) 260px; gap: 1rem; align-items: start; }
    .sidebar, .editor-main { min-width: 0; display: grid; gap: 1rem; }
    .panel { border: 1px solid #dbe4f0; border-radius: 26px; background: #ffffff; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06); padding: 1.2rem; display: grid; gap: 1rem; }
    .compact-panel { gap: 0.8rem; }
    .panel-header, .split-header, .editor-actions, .list-item-top { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
    .helper-copy, .section-help { color: #52607a; font-size: 0.92rem; line-height: 1.45; }
    .scroll-list, .forms-tabs { display: grid; gap: 0.75rem; max-height: 31rem; overflow: auto; padding-right: 0.15rem; }
    .search-input { width: 100%; padding: 0.75rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; color: #0f172a; }
    .list-item { width: 100%; text-align: left; border: 1px solid #dbe4f0; background: #f8fbff; border-radius: 18px; padding: 0.9rem 1rem; display: grid; gap: 0.3rem; cursor: pointer; color: #0f172a; }
    .list-item.selected { border-color: #2563eb; background: #eff6ff; box-shadow: inset 0 0 0 1px #2563eb; }
    .list-item span { color: #52607a; font-size: 0.86rem; }
    .policy-meta, .field-grid, .form-meta-card { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .editor-panel { gap: 1rem; }
    .canvas-wrapper { position: relative; min-height: 34rem; border-radius: 24px; overflow: hidden; border: 1px solid #dbe4f0; background: radial-gradient(circle at top left, #f8fbff, #eef5ff 55%, #ffffff); }
    .canvas { height: 34rem; width: 100%; }
    .canvas-overlay { position: absolute; inset: 0; display: grid; place-content: center; gap: 0.35rem; background: rgba(248, 250, 252, 0.82); color: #0f172a; text-align: center; padding: 1rem; backdrop-filter: blur(2px); }
    .canvas-wrapper.read-only { border-style: dashed; }
    .xml-preview { width: 100%; border-radius: 18px; border: 1px solid #dbe4f0; padding: 1rem; font-family: Consolas, monospace; resize: vertical; color: #475569; background: #f8fafc; }
    .feedback { color: #0369a1; font-weight: 600; }
    .forms-panel { gap: 1rem; }
    .ai-panel { background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%); }
    .ai-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr); gap: 0.85rem; }
    .ai-prompt textarea { min-height: 8rem; }
    .ai-status { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.35rem 0.75rem; background: #eef2ff; color: #4338ca; font-size: 0.78rem; font-weight: 800; white-space: nowrap; }
    .ai-status.listening { background: #fef3c7; color: #92400e; }
    .ai-status.loading { background: #dcfce7; color: #166534; }
    .ai-actions { display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap; }
    .ai-result { border: 1px solid #dbe4f0; border-radius: 18px; padding: 0.9rem 1rem; background: #f8fafc; display: grid; gap: 0.75rem; color: #334155; }
    .ai-result ol, .ai-result ul { margin: 0.5rem 0 0; padding-left: 1.15rem; }
    .ai-result li { margin: 0.25rem 0; }
    .form-builder { display: grid; gap: 1rem; }
    .form-builder-layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 1rem; align-items: start; }
    .field-palette, .fields { display: grid; gap: 0.85rem; }
    .palette-header span { color: #52607a; font-size: 0.86rem; }
    .palette-item { text-align: left; border: 1px solid #dbe4f0; background: #f8fbff; border-radius: 18px; padding: 0.95rem 1rem; display: grid; gap: 0.25rem; }
    .palette-item span { color: #52607a; font-size: 0.86rem; }
    .field-card { display: grid; gap: 0.75rem; border: 1px solid #dbe4f0; border-radius: 22px; padding: 1rem; background: #fff; }
    .field-card-header { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
    .field-card-header span { color: #52607a; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.08em; }
    .compact-grid { grid-template-columns: minmax(0, 1fr) auto; }
    .stacked-field { display: grid; gap: 0.45rem; color: #0f172a; font-weight: 600; }
    .toggle-row { display: flex; justify-content: space-between; gap: 1rem; align-items: center; font-weight: 600; }
    .checkbox-row { display: inline-flex; align-items: center; gap: 0.5rem; color: #334155; font-weight: 600; }
    .empty-state { padding: 1.1rem; border: 1px dashed #cbd5e1; border-radius: 20px; color: #52607a; background: #f8fafc; }
    input, select, textarea, button { font: inherit; }
    input, select, textarea { width: 100%; padding: 0.9rem 1rem; border-radius: 16px; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; min-width: 0; }
    button { border: none; border-radius: 16px; padding: 0.85rem 1rem; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .primary { background: linear-gradient(135deg, #0f766e, #0ea5a4); color: #fff; }
    .secondary { background: #e2e8f0; color: #0f172a; }
    .ghost { background: transparent; color: #0f766e; padding: 0; }
    .danger { background: #fee2e2; color: #b91c1c; justify-self: start; }
    .block { width: 100%; }
    @media (max-width: 1500px) {
      .workspace { grid-template-columns: 250px minmax(0, 1fr); }
      .right-sidebar { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .right-sidebar .panel { align-content: start; }
    }
    @media (max-width: 1180px) {
      .workspace { grid-template-columns: 1fr; }
      .form-builder-layout { grid-template-columns: 1fr; }
      .right-sidebar { order: 3; grid-template-columns: 1fr; }
    }
    @media (max-width: 768px) {
      .page-header { grid-template-columns: 1fr; display: grid; }
      .header-actions { justify-content: stretch; max-width: none; }
      .header-actions button { width: 100%; }
      .metrics-row { grid-template-columns: 1fr; max-width: 100%; }
      .ai-grid { grid-template-columns: 1fr; }
      .ai-actions { justify-content: stretch; }
      .ai-actions button { width: 100%; }
      .policy-meta, .field-grid, .form-meta-card, .compact-grid { grid-template-columns: 1fr; }
      .canvas { height: 24rem; }
    }
  `]
})
export class PolicyEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLDivElement>;

  policies: Policy[] = [];
  departments: DepartmentDefinition[] = [];
  forms: FormDefinition[] = [];
  taskBindings: TaskBinding[] = [];
  selectedPolicy: Policy | null = null;
  selectedTaskId: string | null = null;
  selectedFormId: string | null = null;
  name = '';
  description = '';
  xmlPreview = '';
  feedback = '';
  collaborationStatus = 'La colaboración se habilita cuando la política ya existe y el dueño decide compartirla.';
  ownerDisplayName = '';
  saveStatus: SaveStatus = 'saved';
  collaborationEnabled = false;
  collaborationMode: CollaborationMode = 'PRIVATE';
  policySearch = '';
  taskSearch = '';
  aiPrompt = '';
  aiBusinessContext = '';
  aiGenerating = false;
  aiListening = false;
  aiDetectedSteps: string[] = [];
  aiWarnings: string[] = [];
  deleteInProgress = false;
  private routeSub: Subscription | null = null;
  private pendingPolicyId: string | null = null;

  readonly fieldPalette: FieldPaletteItem[] = [
    { label: 'Texto', description: 'Entrada simple de una línea', type: 'text' },
    { label: 'Número', description: 'Montos, cantidades o códigos', type: 'number' },
    { label: 'Fecha', description: 'Fecha de emisión o vencimiento', type: 'date' },
    { label: 'Textarea', description: 'Observaciones y notas largas', type: 'textarea' },
    { label: 'Selector', description: 'Lista cerrada de opciones', type: 'select' },
    { label: 'Checkbox', description: 'Aceptación o confirmación', type: 'checkbox' }
  ];

  private modeler!: Modeler;
  private collaborationSocket: WebSocket | null = null;
  private collaborationSyncHandle: ReturnType<typeof setTimeout> | null = null;
  private autosaveHandle: ReturnType<typeof setInterval> | null = null;
  private isApplyingRemoteUpdate = false;
  private isSaving = false;
  private hasPendingChanges = false;

  private readonly blankDiagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  constructor(
    private readonly policyService: PolicyService,
    private readonly departmentService: DepartmentService,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  get selectedTaskBinding(): TaskBinding | null {
    return this.taskBindings.find(binding => binding.taskId === this.selectedTaskId) ?? null;
  }

  get selectedForm(): FormDefinition | null {
    return this.forms.find(form => form.id === this.selectedFormId) ?? null;
  }

  get isOwner(): boolean {
    const userId = this.authService.currentUserValue?.id;
    return !this.selectedPolicy || !this.selectedPolicy.ownerUserId || this.selectedPolicy.ownerUserId === userId;
  }

  get canEditCurrentPolicy(): boolean {
    if (!this.selectedPolicy) {
      return true;
    }
    if (this.isOwner) {
      return true;
    }
    return !!this.selectedPolicy.collaborationEnabled && this.selectedPolicy.collaborationMode === 'EDIT_SHARED';
  }

  get canManageCollaboration(): boolean {
    return !this.selectedPolicy || this.isOwner;
  }

  /**
   * Misma regla que backend: dueño de la política o administrador de la empresa.
   */
  get canDeleteSelectedPolicy(): boolean {
    if (!this.selectedPolicy?.id) {
      return false;
    }
    // `ownerUserId` puede llegar vacío en la lista inicial; `isOwner` ya cubre ese caso.
    if (this.isOwner) {
      return true;
    }
    const roles = this.authService.currentUserValue?.roles ?? [];
    return roles.includes('ROLE_ADMIN') || roles.includes('ADMIN');
  }

  get selectedPolicyHeadline(): string {
    if (!this.selectedPolicy) {
      return 'Nueva política (borrador)';
    }
    const name = this.selectedPolicy.name || this.name || 'Sin nombre';
    const status = this.selectedPolicy.status || 'DRAFT';
    const version = this.selectedPolicy.version ?? 1;
    return `${name} · ${status} · v${version}`;
  }

  get collaborationModeLabel(): string {
    if (!this.collaborationEnabled) {
      return 'Privada';
    }
    return this.collaborationMode === 'EDIT_SHARED'
      ? 'Compartida · Edición'
      : 'Compartida · Solo lectura';
  }

  get collaborationHint(): string {
    if (!this.selectedPolicy) {
      return 'La política nueva se guarda como borrador y luego puedes decidir si compartirla.';
    }
    if (!this.isOwner) {
      return this.canEditCurrentPolicy
        ? 'Puedes editar en tiempo real porque el dueño habilitó edición compartida.'
        : 'Puedes observar la política en vivo, pero la edición está bloqueada por el dueño.';
    }
    return this.collaborationEnabled
      ? 'Solo administradores de tu misma empresa verán esta política en tiempo real.'
      : 'Mientras esté privada, otros administradores no la verán como política compartida.';
  }

  get saveStatusLabel(): string {
    switch (this.saveStatus) {
      case 'saving':
        return 'Guardando...';
      case 'unsaved':
        return 'Cambios sin guardar';
      case 'error':
        return 'Error al guardar';
      default:
        return 'Guardado';
    }
  }

  get filteredPolicies(): Policy[] {
    const term = this.policySearch.trim().toLowerCase();
    if (!term) {
      return this.policies;
    }
    return this.policies.filter(policy =>
      (policy.name ?? '').toLowerCase().includes(term) ||
      (policy.description ?? '').toLowerCase().includes(term)
    );
  }

  get filteredTaskBindings(): TaskBinding[] {
    const term = this.taskSearch.trim().toLowerCase();
    if (!term) {
      return this.taskBindings;
    }
    return this.taskBindings.filter(binding =>
      binding.taskName.toLowerCase().includes(term) ||
      binding.departmentRole.toLowerCase().includes(term) ||
      this.resolveFormName(binding.formId).toLowerCase().includes(term)
    );
  }

  get totalFieldCount(): number {
    return this.forms.reduce((acc, form) => acc + form.fields.length, 0);
  }

  get speechSupported(): boolean {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    return !!browserWindow.SpeechRecognition || !!browserWindow.webkitSpeechRecognition;
  }

  get aiStatusLabel(): string {
    if (this.aiGenerating) {
      return 'Generando';
    }
    if (this.aiListening) {
      return 'Escuchando';
    }
    return this.speechSupported ? 'Texto o voz' : 'Texto';
  }

  get canGenerateWithAi(): boolean {
    return this.canEditCurrentPolicy && !this.aiGenerating && this.aiPrompt.trim().length >= 5;
  }

  async ngAfterViewInit(): Promise<void> {
    this.modeler = new Modeler({
      container: this.canvasRef.nativeElement
    });

    this.attachSelectionListener();
    this.startAutosaveLoop();
    this.routeSub = this.route.queryParamMap.subscribe(map => {
      this.pendingPolicyId = map.get('policyId');
      if (this.pendingPolicyId && this.policies.length) {
        const found = this.policies.find(p => p.id === this.pendingPolicyId);
        if (found && this.selectedPolicy?.id !== found.id) {
          void this.selectPolicy(found);
        }
      }
    });
    this.loadPolicies();
    this.loadDepartments();
    await this.importXml(this.blankDiagram);
    this.xmlPreview = this.blankDiagram;
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
      this.routeSub = null;
    }
    if (this.autosaveHandle) {
      clearInterval(this.autosaveHandle);
      this.autosaveHandle = null;
    }
    if (this.collaborationSyncHandle) {
      clearTimeout(this.collaborationSyncHandle);
      this.collaborationSyncHandle = null;
    }
    this.disconnectCollaboration();
    if (this.modeler) {
      this.modeler.destroy();
    }
  }

  loadPolicies(): void {
    this.policyService.getPolicies().subscribe({
      next: policies => {
        this.policies = policies;
        if (this.pendingPolicyId) {
          const found = policies.find(p => p.id === this.pendingPolicyId);
          if (found) {
            void this.selectPolicy(found);
          }
        }
      },
      error: () => {
        this.feedback = 'No se pudo cargar el catálogo de políticas.';
      }
    });
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: departments => {
        this.departments = departments;
      },
      error: () => {
        this.feedback = 'No se pudo cargar el catálogo de departamentos.';
      }
    });
  }

  async selectPolicy(policy: Policy): Promise<void> {
    this.disconnectCollaboration();
    this.selectedPolicy = { ...policy };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { policyId: policy.id },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.name = policy.name ?? '';
    this.description = policy.description ?? '';
    this.forms = this.cloneForms(policy.forms ?? []);
    this.selectedFormId = this.forms[0]?.id ?? null;
    this.collaborationEnabled = !!policy.collaborationEnabled;
    this.collaborationMode = this.resolveCollaborationMode(policy.collaborationEnabled, policy.collaborationMode);
    this.ownerDisplayName = policy.ownerUserId === this.authService.currentUserValue?.id
      ? this.authService.currentUserValue?.username ?? 'Administrador'
      : 'Administrador';

    const xml = policy.bpmnXml || this.blankDiagram;
    await this.importXml(xml);
    this.syncTasksFromXml(xml);
    this.xmlPreview = xml;
    this.hasPendingChanges = false;
    this.saveStatus = 'saved';
    this.feedback = `Política ${policy.name} cargada.`;
    this.updateCollaborationStatus();
    this.connectCollaboration(policy.id);
  }

  async savePolicy(): Promise<void> {
    await this.persistPolicy(false);
  }

  publishPolicy(): void {
    if (!this.selectedPolicy) {
      this.feedback = 'Guarda la política antes de publicarla.';
      return;
    }

    this.policyService.publishPolicy(this.selectedPolicy.id).subscribe({
      next: () => {
        this.feedback = 'Política publicada correctamente.';
        this.loadPolicies();
      },
      error: err => {
        this.feedback = err.error?.message ?? 'No se pudo publicar la política.';
      }
    });
  }

  confirmDeletePolicy(): void {
    if (!this.selectedPolicy || !this.canDeleteSelectedPolicy || this.deleteInProgress) {
      return;
    }
    const policyName = this.selectedPolicy.name || 'esta política';
    const message =
      `¿Eliminar permanentemente "${policyName}"?\n\n` +
      'Se borrarán instancias de trámite, tareas, documentos adjuntos y versiones publicadas del workflow. ' +
      'Los formularios definidos solo en esta política se pierden con ella. Esta acción no se puede deshacer.';
    if (!confirm(message)) {
      return;
    }
    const id = this.selectedPolicy.id;
    this.deleteInProgress = true;
    this.feedback = 'Eliminando política y datos relacionados...';
    this.policyService.deletePolicy(id).subscribe({
      next: () => {
        this.deleteInProgress = false;
        this.policies = this.policies.filter(p => p.id !== id);
        this.disconnectCollaboration();
        void this.resetWorkspace();
        this.feedback = 'Política eliminada correctamente.';
      },
      error: err => {
        this.deleteInProgress = false;
        if (err.status === 403) {
          this.feedback = 'No tienes permiso para eliminar esta política (solo el dueño o un administrador de la empresa).';
        } else {
          this.feedback = err.error?.message ?? 'No se pudo eliminar la política.';
        }
      }
    });
  }

  generateDiagramFromAi(): void {
    if (!this.canGenerateWithAi) {
      this.feedback = 'Describe el trámite con al menos 5 caracteres para generar el diagrama.';
      return;
    }

    this.aiGenerating = true;
    this.aiWarnings = [];
    this.aiDetectedSteps = [];
    this.feedback = 'Generando diagrama desde IA...';

    this.policyService.generateDiagramFromPrompt({
      prompt: this.aiPrompt.trim(),
      business_context: this.aiBusinessContext.trim() || undefined,
      output_format: 'bpmn'
    }).subscribe({
      next: response => {
        void this.applyGeneratedDiagram(response);
      },
      error: err => {
        this.aiGenerating = false;
        this.feedback = err.status === 0
          ? 'No se pudo conectar con el servicio de IA configurado. Verifica que esté iniciado y accesible.'
          : err.error?.message ?? 'No se pudo generar el diagrama con IA.';
      }
    });
  }

  startVoicePrompt(): void {
    if (!this.speechSupported || !this.canEditCurrentPolicy) {
      this.feedback = 'El dictado por voz no está disponible en este navegador.';
      return;
    }

    const browserWindow = window as typeof window & {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    };
    const SpeechRecognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    this.aiListening = true;
    this.feedback = 'Escuchando descripción del flujo...';

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? '';
      this.aiPrompt = `${this.aiPrompt ? `${this.aiPrompt.trim()} ` : ''}${transcript}`.trim();
      this.feedback = 'Dictado agregado al prompt.';
    };

    recognition.onerror = () => {
      this.feedback = 'No se pudo capturar audio. Revisa permisos del micrófono e intenta nuevamente.';
    };

    recognition.onend = () => {
      this.aiListening = false;
    };

    recognition.start();
  }

  clearAiPrompt(): void {
    this.aiPrompt = '';
    this.aiBusinessContext = '';
    this.aiDetectedSteps = [];
    this.aiWarnings = [];
  }

  async exportXml(): Promise<void> {
    const result = await this.modeler.saveXML({ format: true });
    this.xmlPreview = this.enrichXmlWithTaskBindings(result.xml ?? '');
    this.feedback = 'XML exportado con configuración de tareas.';
  }

  refreshTaskBindings(): void {
    const currentXml = this.xmlPreview || this.blankDiagram;
    this.syncTasksFromXml(currentXml);
    this.feedback = 'Tareas humanas sincronizadas desde el diagrama.';
    this.markDirty();
  }

  addForm(): void {
    if (!this.canEditCurrentPolicy) {
      return;
    }

    const formIndex = this.forms.length + 1;
    const form: FormDefinition = {
      id: this.generateId('form'),
      name: `Formulario ${formIndex}`,
      description: '',
      fields: []
    };
    this.forms = [...this.forms, form];
    this.selectedFormId = form.id;
    this.markDirty();
  }

  selectForm(formId: string): void {
    this.selectedFormId = formId;
  }

  addField(type: FormFieldDefinition['type'] = 'text'): void {
    if (!this.selectedForm || !this.canEditCurrentPolicy) {
      return;
    }
    const fieldIndex = this.selectedForm.fields.length + 1;
    this.selectedForm.fields.push({
      id: this.generateId('field'),
      name: `campo_${fieldIndex}`,
      label: `Campo ${fieldIndex}`,
      type,
      required: false,
      options: type === 'select' ? [{ label: 'Opción 1', value: 'opcion_1' }] : []
    });
    this.markDirty();
  }

  removeField(index: number): void {
    if (!this.selectedForm || !this.canEditCurrentPolicy) {
      return;
    }
    this.selectedForm.fields.splice(index, 1);
    this.markDirty();
  }

  serializeOptions(field: FormFieldDefinition): string {
    return (field.options ?? []).map(option => option.label).join('\n');
  }

  updateFieldOptions(field: FormFieldDefinition, rawValue: string): void {
    field.options = rawValue
      .split('\n')
      .map(option => option.trim())
      .filter(Boolean)
      .map(option => ({ label: option, value: option }));
    this.markDirty();
  }

  selectTask(taskId: string): void {
    this.selectedTaskId = taskId;
  }

  focusTaskOnCanvas(): void {
    if (!this.selectedTaskId) {
      return;
    }

    const elementRegistry = this.modeler.get('elementRegistry') as any;
    const selection = this.modeler.get('selection') as any;
    const canvas = this.modeler.get('canvas') as any;
    const element = elementRegistry.get(this.selectedTaskId);
    if (element) {
      selection.select(element);
      canvas.scrollToElement(element);
    }
  }

  resolveFormName(formId: string): string {
    if (!formId) {
      return 'Sin formulario';
    }
    return this.forms.find(form => form.id === formId)?.name ?? 'Formulario no encontrado';
  }

  policyBadge(policy: Policy): string {
    if (!policy.collaborationEnabled) {
      return 'Privada';
    }
    return policy.collaborationMode === 'EDIT_SHARED'
      ? 'Compartida · Edición'
      : 'Compartida · Solo lectura';
  }

  async resetWorkspace(): Promise<void> {
    this.disconnectCollaboration();
    this.selectedPolicy = null;
    this.selectedTaskId = null;
    this.selectedFormId = null;
    this.name = '';
    this.description = '';
    this.forms = [];
    this.taskBindings = [];
    this.feedback = '';
    this.ownerDisplayName = this.authService.currentUserValue?.username ?? '';
    this.collaborationEnabled = false;
    this.collaborationMode = 'PRIVATE';
    this.hasPendingChanges = true;
    this.saveStatus = 'unsaved';
    this.collaborationStatus = 'Esta política nueva se autosalvará como borrador, por ejemplo Sin nombre 1.';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { policyId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    await this.importXml(this.blankDiagram);
    this.xmlPreview = this.blankDiagram;
  }

  toggleSharedMode(event: Event): void {
    if (!this.canManageCollaboration) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    this.collaborationEnabled = checked;
    this.collaborationMode = checked ? (this.collaborationMode === 'EDIT_SHARED' ? 'EDIT_SHARED' : 'READ_ONLY') : 'PRIVATE';
    this.updateSelectedPolicyMetadata();
    this.markDirty();
    this.broadcastModeChange();
  }

  changeCollaborationMode(mode: CollaborationMode): void {
    if (!this.canManageCollaboration) {
      return;
    }
    this.collaborationEnabled = true;
    this.collaborationMode = mode === 'EDIT_SHARED' ? 'EDIT_SHARED' : 'READ_ONLY';
    this.updateSelectedPolicyMetadata();
    this.markDirty();
    this.broadcastModeChange();
  }

  markDirty(): void {
    if (this.isApplyingRemoteUpdate || !this.canEditCurrentPolicy) {
      return;
    }
    this.hasPendingChanges = true;
    this.saveStatus = 'unsaved';
    this.updateSelectedPolicyMetadata();
    this.scheduleCollaborationSync();
  }

  private updateSelectedPolicyMetadata(): void {
    if (!this.selectedPolicy) {
      return;
    }
    this.selectedPolicy = {
      ...this.selectedPolicy,
      name: this.name || this.selectedPolicy.name,
      description: this.description,
      forms: this.cloneForms(this.forms),
      collaborationEnabled: this.collaborationEnabled,
      collaborationMode: this.collaborationEnabled ? this.collaborationMode : 'PRIVATE'
    };
    this.updateCollaborationStatus();
  }

  private startAutosaveLoop(): void {
    this.autosaveHandle = setInterval(() => {
      if (!this.hasPendingChanges || this.isSaving || !this.canEditCurrentPolicy) {
        return;
      }
      void this.persistPolicy(true);
    }, 5000);
  }

  private async persistPolicy(automatic: boolean): Promise<void> {
    if (!this.canEditCurrentPolicy || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.saveStatus = 'saving';
    try {
      const result = await this.modeler.saveXML({ format: true });
      const enrichedXml = this.enrichXmlWithTaskBindings(result.xml ?? this.blankDiagram);
      this.xmlPreview = enrichedXml;

      const payload: CreatePolicyRequest = {
        name: this.name,
        description: this.description,
        bpmnXml: enrichedXml,
        departments: this.departments,
        forms: this.cloneForms(this.forms),
        collaborationEnabled: this.collaborationEnabled,
        collaborationMode: this.collaborationEnabled ? this.collaborationMode : 'PRIVATE'
      };

      const request$ = this.selectedPolicy
        ? this.policyService.updatePolicy(this.selectedPolicy.id, {
            ...this.selectedPolicy,
            ...payload,
            forms: payload.forms,
            departments: payload.departments
          })
        : this.policyService.createPolicy(payload);

      request$.subscribe({
        next: policy => {
          this.selectedPolicy = { ...policy };
          this.name = policy.name;
          this.description = policy.description ?? '';
          this.collaborationEnabled = !!policy.collaborationEnabled;
          this.collaborationMode = this.resolveCollaborationMode(policy.collaborationEnabled, policy.collaborationMode);
          this.ownerDisplayName = policy.ownerUserId === this.authService.currentUserValue?.id
            ? this.authService.currentUserValue?.username ?? 'Administrador'
            : this.ownerDisplayName || 'Administrador';
          this.hasPendingChanges = false;
          this.saveStatus = 'saved';
          this.isSaving = false;
          this.feedback = automatic
            ? `Borrador autosalvado${policy.name ? ` como ${policy.name}` : ''}.`
            : 'Política guardada correctamente.';
          this.upsertPolicyInList(policy);
          this.updateCollaborationStatus();
          if (!this.collaborationSocket) {
            this.connectCollaboration(policy.id);
          }
          this.pushCollaborationSnapshot('AUTOSAVE_ACK');
        },
        error: err => {
          this.isSaving = false;
          this.saveStatus = 'error';
          this.feedback = err.error?.message ?? 'No se pudo guardar la política.';
        }
      });
    } catch {
      this.isSaving = false;
      this.saveStatus = 'error';
      this.feedback = 'No se pudo serializar el diagrama para guardarlo.';
    }
  }

  private upsertPolicyInList(policy: Policy): void {
    const index = this.policies.findIndex(item => item.id === policy.id);
    if (index >= 0) {
      const updated = [...this.policies];
      updated[index] = policy;
      this.policies = updated;
      return;
    }
    this.policies = [policy, ...this.policies];
  }

  private attachSelectionListener(): void {
    const eventBus = this.modeler.get('eventBus') as any;
    eventBus.on('selection.changed', (event: any) => {
      const selected = event.newSelection?.[0];
      if (selected?.type === 'bpmn:UserTask') {
        this.selectedTaskId = selected.id;
      }
    });

    eventBus.on('commandStack.changed', async () => {
      if (this.isApplyingRemoteUpdate || !this.canEditCurrentPolicy) {
        return;
      }
      const result = await this.modeler.saveXML({ format: true });
      const enrichedXml = this.enrichXmlWithTaskBindings(result.xml ?? '');
      this.xmlPreview = enrichedXml;
      this.syncTasksFromXml(enrichedXml);
      this.markDirty();
    });
  }

  private async importXml(xml: string): Promise<void> {
    await this.modeler.importXML(xml);
    const canvas = this.modeler.get('canvas') as any;
    canvas.zoom('fit-viewport');
  }

  private async applyGeneratedDiagram(response: DiagramGenerationResponse): Promise<void> {
    try {
      if (!response.success || !response.generated_structure?.nodes?.length) {
        this.feedback = 'La IA no devolvió una estructura de diagrama válida.';
        return;
      }

      const visualXml = this.buildVisualBpmnFromGeneratedStructure(response.generated_structure.nodes, response.generated_structure.flows);
      await this.importXml(visualXml);
      this.xmlPreview = visualXml;
      this.syncTasksFromXml(visualXml);
      this.aiDetectedSteps = response.detected_steps.map(step =>
        String(step['label'] ?? step['text'] ?? step['id'] ?? 'Paso detectado')
      );
      this.aiWarnings = response.warnings ?? [];

      if (!this.name.trim()) {
        this.name = this.suggestPolicyNameFromPrompt(this.aiPrompt);
      }

      this.feedback = 'Diagrama generado por IA y aplicado al diseñador. Revisa tareas humanas, departamentos y formularios antes de publicar.';
      this.markDirty();
    } catch {
      this.saveStatus = 'error';
      this.feedback = 'La IA generó una respuesta, pero no se pudo cargar como diagrama BPMN visual.';
    } finally {
      this.aiGenerating = false;
    }
  }

  private buildVisualBpmnFromGeneratedStructure(nodes: GeneratedDiagramNode[], flows: GeneratedDiagramFlow[]): string {
    const shapeWidth = (node: GeneratedDiagramNode) => node.type === 'START' || node.type === 'END' ? 36 : node.type === 'DECISION' || node.type === 'PARALLEL' ? 50 : 130;
    const shapeHeight = (node: GeneratedDiagramNode) => node.type === 'START' || node.type === 'END' ? 36 : node.type === 'DECISION' || node.type === 'PARALLEL' ? 50 : 76;
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>();

    nodes.forEach((node, index) => {
      const width = shapeWidth(node);
      const height = shapeHeight(node);
      positions.set(node.id, {
        x: 120 + index * 190,
        y: 180 - height / 2,
        width,
        height
      });
    });

    const processItems = nodes.map(node => this.renderBpmnNode(node)).join('\n');
    const flowItems = flows.map(flow =>
      `    <bpmn:sequenceFlow id="${this.escapeXml(flow.id)}" sourceRef="${this.escapeXml(flow.source)}" targetRef="${this.escapeXml(flow.target)}" />`
    ).join('\n');

    const shapeItems = nodes.map(node => {
      const bounds = positions.get(node.id);
      if (!bounds) {
        return '';
      }
      const marker = node.type === 'DECISION' || node.type === 'PARALLEL' ? ' isMarkerVisible="true"' : '';
      return `      <bpmndi:BPMNShape id="Shape_${this.escapeXml(node.id)}" bpmnElement="${this.escapeXml(node.id)}"${marker}>
        <dc:Bounds x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" />
      </bpmndi:BPMNShape>`;
    }).join('\n');

    const edgeItems = flows.map(flow => {
      const source = positions.get(flow.source);
      const target = positions.get(flow.target);
      if (!source || !target) {
        return '';
      }
      const sourceX = source.x + source.width;
      const sourceY = source.y + source.height / 2;
      const targetX = target.x;
      const targetY = target.y + target.height / 2;
      return `      <bpmndi:BPMNEdge id="Edge_${this.escapeXml(flow.id)}" bpmnElement="${this.escapeXml(flow.id)}">
        <di:waypoint x="${sourceX}" y="${sourceY}" />
        <di:waypoint x="${targetX}" y="${targetY}" />
      </bpmndi:BPMNEdge>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_Generated"
                  targetNamespace="https://workflow-cloud.local/bpmn">
  <bpmn:process id="Process_Generated" name="Workflow generado por IA" isExecutable="true">
${processItems}
${flowItems}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Generated">
    <bpmndi:BPMNPlane id="BPMNPlane_Generated" bpmnElement="Process_Generated">
${shapeItems}
${edgeItems}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  }

  private renderBpmnNode(node: GeneratedDiagramNode): string {
    const id = this.escapeXml(node.id);
    const name = this.escapeXml(node.label || node.id);
    switch (node.type) {
      case 'START':
        return `    <bpmn:startEvent id="${id}" name="${name}" />`;
      case 'END':
        return `    <bpmn:endEvent id="${id}" name="${name}" />`;
      case 'DECISION':
        return `    <bpmn:exclusiveGateway id="${id}" name="${name}" />`;
      case 'PARALLEL':
        return `    <bpmn:parallelGateway id="${id}" name="${name}" />`;
      default:
        return `    <bpmn:userTask id="${id}" name="${name}" />`;
    }
  }

  private suggestPolicyNameFromPrompt(prompt: string): string {
    const normalized = prompt.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return 'Política generada por IA';
    }
    return normalized.length > 48
      ? `${normalized.slice(0, 48)}...`
      : normalized;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private syncTasksFromXml(xml: string): void {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const taskElements = Array.from(doc.getElementsByTagName('bpmn:userTask'));
    const previousBindings = new Map(this.taskBindings.map(binding => [binding.taskId, binding]));

    this.taskBindings = taskElements.map(element => {
      const taskId = element.getAttribute('id') ?? '';
      const previous = previousBindings.get(taskId);
      return {
        taskId,
        taskName: element.getAttribute('name') || taskId,
        departmentRole: element.getAttribute('data-role') || previous?.departmentRole || '',
        formId: element.getAttribute('data-form-id') || previous?.formId || ''
      };
    });

    this.selectedTaskId = this.taskBindings[0]?.taskId ?? null;
  }

  private enrichXmlWithTaskBindings(xml: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const taskElements = Array.from(doc.getElementsByTagName('bpmn:userTask'));

    this.taskBindings.forEach(binding => {
      const task = taskElements.find(element => element.getAttribute('id') === binding.taskId) ?? null;
      if (!task) {
        return;
      }

      if (binding.departmentRole) {
        task.setAttribute('data-role', binding.departmentRole);
      } else {
        task.removeAttribute('data-role');
      }

      if (binding.formId) {
        task.setAttribute('data-form-id', binding.formId);
      } else {
        task.removeAttribute('data-form-id');
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  private scheduleCollaborationSync(): void {
    if (!this.selectedPolicy || !this.canEditCurrentPolicy || !this.collaborationSocket || this.collaborationSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (this.collaborationSyncHandle) {
      clearTimeout(this.collaborationSyncHandle);
    }

    this.collaborationSyncHandle = setTimeout(() => {
      this.pushCollaborationSnapshot('STATE_SYNC');
    }, 400);
  }

  private async pushCollaborationSnapshot(type: CollaborationMessage['type']): Promise<void> {
    if (!this.selectedPolicy || !this.canEditCurrentPolicy || !this.collaborationSocket || this.collaborationSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const result = await this.modeler.saveXML({ format: true });
    const enrichedXml = this.enrichXmlWithTaskBindings(result.xml ?? this.blankDiagram);
    this.xmlPreview = enrichedXml;

    const payload: CollaborationMessage = {
      type,
      policyId: this.selectedPolicy.id,
      actor: this.authService.currentUserValue?.username ?? 'admin',
      actorDisplayName: this.authService.currentUserValue?.username ?? 'admin',
      actorUserId: this.authService.currentUserValue?.id,
      ownerUserId: this.selectedPolicy.ownerUserId,
      ownerDisplayName: this.ownerDisplayName,
      empresa: this.authService.currentUserValue?.empresa,
      collaborationEnabled: this.collaborationEnabled,
      collaborationMode: this.collaborationEnabled ? this.collaborationMode : 'PRIVATE',
      canEdit: this.canEditCurrentPolicy,
      policyName: this.selectedPolicy.name,
      name: this.name,
      description: this.description,
      bpmnXml: enrichedXml,
      forms: this.cloneForms(this.forms),
      taskBindings: this.cloneTaskBindings(this.taskBindings),
      timestamp: Date.now()
    };

    this.collaborationSocket.send(JSON.stringify(payload));
  }

  private broadcastModeChange(): void {
    if (!this.selectedPolicy || !this.canManageCollaboration || !this.collaborationSocket || this.collaborationSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload: CollaborationMessage = {
      type: 'MODE_CHANGED',
      policyId: this.selectedPolicy.id,
      actor: this.authService.currentUserValue?.username ?? 'admin',
      actorDisplayName: this.authService.currentUserValue?.username ?? 'admin',
      actorUserId: this.authService.currentUserValue?.id,
      ownerUserId: this.selectedPolicy.ownerUserId,
      ownerDisplayName: this.ownerDisplayName,
      empresa: this.authService.currentUserValue?.empresa,
      collaborationEnabled: this.collaborationEnabled,
      collaborationMode: this.collaborationEnabled ? this.collaborationMode : 'PRIVATE',
      canEdit: this.canEditCurrentPolicy,
      policyName: this.selectedPolicy.name,
      name: this.name,
      description: this.description,
      bpmnXml: this.xmlPreview,
      forms: this.cloneForms(this.forms),
      taskBindings: this.cloneTaskBindings(this.taskBindings),
      timestamp: Date.now()
    };

    this.collaborationSocket.send(JSON.stringify(payload));
  }

  private connectCollaboration(policyId: string): void {
    const token = this.authService.getToken();
    if (!policyId || !token) {
      return;
    }

    const endpoint = `${runtimeConfig.wsBaseUrl}/policies/${policyId}?token=${encodeURIComponent(token)}`;
    this.collaborationSocket = new WebSocket(endpoint);

    this.collaborationSocket.onopen = () => {
      this.updateCollaborationStatus();
    };

    this.collaborationSocket.onmessage = async (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as CollaborationMessage;
      if (payload.type === 'ERROR') {
        this.feedback = payload.description || 'No tienes permiso de edición sobre esta política.';
        this.saveStatus = 'error';
        return;
      }

      this.ownerDisplayName = payload.ownerDisplayName || this.ownerDisplayName;
      this.applyPermissionMetadata(payload);

      if (payload.type === 'PRESENCE') {
        this.updateCollaborationStatus(payload.actorDisplayName || payload.actor);
        return;
      }

      if (payload.actorUserId && payload.actorUserId === this.authService.currentUserValue?.id) {
        this.updateCollaborationStatus();
        return;
      }

      if (payload.type === 'MODE_CHANGED') {
        this.feedback = `El acceso colaborativo cambió a ${this.collaborationModeLabel.toLowerCase()}.`;
        this.updateCollaborationStatus(payload.actorDisplayName || payload.actor);
        return;
      }

      if (payload.type === 'STATE_SYNC' || payload.type === 'AUTOSAVE_ACK') {
        await this.applyRemoteSnapshot(payload);
        this.feedback = `Cambios recibidos en vivo desde ${payload.actorDisplayName || payload.actor}.`;
      }
    };

    this.collaborationSocket.onclose = () => {
      this.collaborationStatus = 'La sesión colaborativa se cerró. Guarda o vuelve a abrir la política para reconectar.';
      this.collaborationSocket = null;
    };

    this.collaborationSocket.onerror = () => {
      this.collaborationStatus = 'No se pudo establecer la colaboración en vivo.';
    };
  }

  private applyPermissionMetadata(payload: CollaborationMessage): void {
    this.collaborationEnabled = !!payload.collaborationEnabled;
    this.collaborationMode = this.resolveCollaborationMode(payload.collaborationEnabled, payload.collaborationMode);

    if (this.selectedPolicy) {
      this.selectedPolicy = {
        ...this.selectedPolicy,
        ownerUserId: payload.ownerUserId ?? this.selectedPolicy.ownerUserId,
        collaborationEnabled: this.collaborationEnabled,
        collaborationMode: this.collaborationMode
      };
    }
  }

  private async applyRemoteSnapshot(payload: CollaborationMessage): Promise<void> {
    this.isApplyingRemoteUpdate = true;
    try {
      this.name = payload.name;
      this.description = payload.description;
      this.forms = this.cloneForms(payload.forms ?? []);
      this.selectedFormId = this.forms[0]?.id ?? this.selectedFormId;
      this.taskBindings = this.cloneTaskBindings(payload.taskBindings ?? []);
      await this.importXml(payload.bpmnXml || this.blankDiagram);
      this.syncTasksFromXml(payload.bpmnXml || this.blankDiagram);
      this.xmlPreview = payload.bpmnXml || this.blankDiagram;
      this.hasPendingChanges = false;
      this.saveStatus = 'saved';
      this.updateCollaborationStatus(payload.actorDisplayName || payload.actor);
    } finally {
      this.isApplyingRemoteUpdate = false;
    }
  }

  private updateCollaborationStatus(actorName?: string): void {
    if (!this.selectedPolicy) {
      this.collaborationStatus = 'La política nueva se guardará automáticamente como borrador, por ejemplo Sin nombre 1.';
      return;
    }

    if (!this.collaborationEnabled) {
      this.collaborationStatus = 'Esta política permanece privada. Solo tú la editas hasta que habilites el modo compartido.';
      return;
    }

    if (this.isOwner) {
      this.collaborationStatus = this.collaborationMode === 'EDIT_SHARED'
        ? 'Los administradores de tu empresa pueden editar esta política en tiempo real.'
        : 'Los administradores de tu empresa pueden verla en vivo, pero solo tú puedes editarla.';
      return;
    }

    this.collaborationStatus = this.canEditCurrentPolicy
      ? `Estás colaborando con edición compartida${actorName ? ` junto a ${actorName}` : ''}.`
      : `Estás observando en solo lectura${actorName ? ` junto a ${actorName}` : ''}.`;
  }

  private disconnectCollaboration(): void {
    if (this.collaborationSyncHandle) {
      clearTimeout(this.collaborationSyncHandle);
      this.collaborationSyncHandle = null;
    }
    if (this.collaborationSocket) {
      this.collaborationSocket.close();
      this.collaborationSocket = null;
    }
  }

  private resolveCollaborationMode(enabled?: boolean, mode?: string): CollaborationMode {
    if (!enabled) {
      return 'PRIVATE';
    }
    return mode === 'EDIT_SHARED' ? 'EDIT_SHARED' : 'READ_ONLY';
  }

  private cloneForms(forms: FormDefinition[]): FormDefinition[] {
    return forms.map(form => ({
      ...form,
      fields: form.fields.map(field => ({
        ...field,
        options: [...(field.options ?? [])]
      }))
    }));
  }

  private cloneTaskBindings(bindings: TaskBinding[]): TaskBinding[] {
    return bindings.map(binding => ({ ...binding }));
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
