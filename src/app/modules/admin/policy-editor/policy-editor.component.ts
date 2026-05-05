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
  umlActivityJson?: UmlActivityStructure;
  forms: FormDefinition[];
  taskBindings: TaskBinding[];
  timestamp: number;
}

interface UmlActivityPartition {
  id: string;
  name: string;
  umlElement?: string;
}

interface UmlActivityNode {
  id: string;
  type: 'INITIAL' | 'ACTION' | 'DECISION' | 'MERGE' | 'FORK' | 'JOIN' | 'ACTIVITY_FINAL' | 'OBJECT_NODE' | 'SEND_SIGNAL' | 'ACCEPT_SIGNAL' | 'NOTE' | string;
  label: string;
  partition: string;
  umlElement?: string;
  x?: number;
  y?: number;
}

interface UmlActivityEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  guard?: string;
}

interface UmlActivityStructure {
  nodes: UmlActivityNode[];
  edges: UmlActivityEdge[];
  partitions: UmlActivityPartition[];
  metadata: Record<string, unknown>;
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
              <div>
                <h3>Diagrama UML 2.5 de actividad</h3>
                <p class="section-help">Edita el diagrama de negocio directamente: calles, acciones, decisiones, objetos, señales y flujos UML.</p>
              </div>
              <button class="secondary" type="button" [disabled]="!canEditCurrentPolicy" (click)="refreshTaskBindings()">Sincronizar tareas</button>
            </div>

            <div class="uml-toolbar" [class.read-only]="!canEditCurrentPolicy">
              <div class="uml-toolbar-group">
                <label class="stacked-field">
                  <span>Nueva calle</span>
                  <input
                    [(ngModel)]="newUmlPartitionName"
                    [disabled]="!canEditCurrentPolicy"
                    placeholder="Ej. Cliente, Ventas, Sistema"
                  />
                </label>
                <button class="secondary" type="button" [disabled]="!canEditCurrentPolicy" (click)="addUmlPartition()">Agregar calle</button>
              </div>

              <div class="uml-toolbar-group node-group">
                <label class="stacked-field">
                  <span>Tipo UML</span>
                  <select [(ngModel)]="newUmlNodeType" [disabled]="!canEditCurrentPolicy">
                    <option *ngFor="let option of umlNodeTypeOptions" [value]="option.value">{{ option.label }}</option>
                  </select>
                </label>
                <label class="stacked-field wide-field">
                  <span>Nombre del nodo</span>
                  <input
                    [(ngModel)]="newUmlNodeLabel"
                    [disabled]="!canEditCurrentPolicy"
                    placeholder="Ej. Validar documentos"
                  />
                </label>
                <label class="stacked-field">
                  <span>Calle</span>
                  <select [(ngModel)]="newUmlNodePartition" [disabled]="!canEditCurrentPolicy">
                    <option *ngFor="let partition of umlActivityJson.partitions" [value]="partition.id">{{ partition.name }}</option>
                  </select>
                </label>
                <button class="primary" type="button" [disabled]="!canEditCurrentPolicy" (click)="addUmlNode()">Agregar nodo</button>
              </div>
            </div>

            <div class="bpmn-internal-canvas" aria-hidden="true">
              <div #canvas class="canvas"></div>
            </div>

            <div class="uml-workbench">
              <aside class="uml-palette" aria-label="Herramientas UML">
                <button
                  *ngFor="let option of umlNodeTypeOptions"
                  type="button"
                  [class.active]="newUmlNodeType === option.value"
                  [disabled]="!canEditCurrentPolicy"
                  (click)="selectUmlTool(option.value)"
                  [title]="option.label"
                >
                  <span [ngClass]="toolIconClass(option.value)"></span>
                  <small>{{ option.short }}</small>
                </button>
              </aside>

              <div
                class="uml-canvas-shell"
                [class.panning]="umlPanState"
                (mousedown)="beginUmlPan($event)"
                (mousemove)="dragUmlNode($event)"
                (mouseup)="endUmlNodeDrag()"
                (mouseleave)="endUmlNodeDrag()"
                (wheel)="zoomUmlCanvas($event)"
              >
                <div class="uml-canvas-toolbar">
                  <strong>Diagrama UML {{ umlActivityJson.metadata['umlVersion'] }} de actividad</strong>
                  <span>{{ umlActivityJson.partitions.length }} calles · {{ umlActivityJson.nodes.length }} nodos · {{ umlActivityJson.edges.length }} flujos</span>
                </div>
                <div
                  class="uml-canvas"
                  [style.width.px]="umlCanvasWidth"
                  [style.height.px]="umlCanvasHeight"
                  [style.zoom]="umlZoom"
                  (dblclick)="addUmlNodeAt($event)"
                >
                  <div
                    class="uml-horizontal-lane"
                    *ngFor="let partition of umlActivityJson.partitions; let i = index"
                    [style.top.px]="i * umlLaneHeight"
                    [style.height.px]="umlLaneHeight"
                  >
                    <input
                      [ngModel]="partition.name"
                      [disabled]="!canEditCurrentPolicy"
                      (ngModelChange)="renameUmlPartition(partition.id, $event)"
                      (mousedown)="$event.stopPropagation()"
                    />
                  </div>

                  <svg class="uml-edge-layer" [attr.viewBox]="'0 0 ' + umlCanvasWidth + ' ' + umlCanvasHeight">
                    <defs>
                      <marker id="umlArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#111827"></path>
                      </marker>
                    </defs>
                    <g *ngFor="let edge of umlActivityJson.edges">
                      <line
                        [attr.x1]="edgeStart(edge).x"
                        [attr.y1]="edgeStart(edge).y"
                        [attr.x2]="edgeEnd(edge).x"
                        [attr.y2]="edgeEnd(edge).y"
                        [attr.class]="edgeSvgClass(edge)"
                        marker-end="url(#umlArrow)"
                      ></line>
                      <text
                        *ngIf="edge.guard"
                        class="uml-edge-label"
                        [attr.x]="edgeLabelPoint(edge).x"
                        [attr.y]="edgeLabelPoint(edge).y"
                      >
                        {{ edge.guard }}
                      </text>
                    </g>
                  </svg>

                  <div
                    *ngFor="let node of umlActivityJson.nodes"
                    class="uml-canvas-node"
                    [class.selected]="node.id === selectedUmlNodeId"
                    [ngClass]="umlNodeClass(node)"
                    [ngStyle]="umlNodeStyle(node)"
                    (mousedown)="beginUmlNodeDrag($event, node)"
                    (click)="selectUmlNode(node.id); $event.stopPropagation()"
                    (dblclick)="$event.stopPropagation()"
                    [title]="nodeTypeLabel(node)"
                  >
                    <input
                      *ngIf="node.type !== 'INITIAL' && node.type !== 'ACTIVITY_FINAL' && node.type !== 'FORK' && node.type !== 'JOIN'"
                      [ngModel]="node.label"
                      [disabled]="!canEditCurrentPolicy"
                      (ngModelChange)="updateUmlNode(node.id, 'label', $event)"
                      (mousedown)="$event.stopPropagation()"
                      (click)="$event.stopPropagation()"
                    />
                    <span *ngIf="node.type === 'FORK' || node.type === 'JOIN'"></span>
                  </div>
                </div>
              </div>

              <aside class="uml-inspector">
                <h4>Inspector</h4>
                <ng-container *ngIf="selectedUmlNode as node; else noNodeSelected">
                  <label class="stacked-field">
                    <span>Nombre</span>
                    <input
                      [ngModel]="node.label"
                      [disabled]="!canEditCurrentPolicy || node.type === 'INITIAL'"
                      (ngModelChange)="updateUmlNode(node.id, 'label', $event)"
                    />
                  </label>
                  <label class="stacked-field">
                    <span>Tipo</span>
                    <select
                      [ngModel]="node.type"
                      [disabled]="!canEditCurrentPolicy || node.type === 'INITIAL'"
                      (ngModelChange)="updateUmlNode(node.id, 'type', $event)"
                    >
                      <option *ngFor="let option of editableUmlNodeTypeOptions" [value]="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                  <label class="stacked-field">
                    <span>Calle</span>
                    <select
                      [ngModel]="node.partition"
                      [disabled]="!canEditCurrentPolicy"
                      (ngModelChange)="updateUmlNode(node.id, 'partition', $event)"
                    >
                      <option *ngFor="let partition of umlActivityJson.partitions" [value]="partition.id">{{ partition.name }}</option>
                    </select>
                  </label>
                  <button class="danger" type="button" [disabled]="!canEditCurrentPolicy || node.type === 'INITIAL'" (click)="removeUmlNode(node.id)">
                    Quitar nodo
                  </button>
                </ng-container>
                <ng-template #noNodeSelected>
                  <p class="section-help">Selecciona un nodo del canvas para editarlo. Arrastra dentro de las calles para moverlo.</p>
                </ng-template>

                <div class="uml-guard-editor" *ngIf="decisionEdges().length">
                  <h4>Guardas</h4>
                  <label class="stacked-field" *ngFor="let edge of decisionEdges()">
                    <span>{{ nodeLabelById(edge.source) }} -> {{ nodeLabelById(edge.target) }}</span>
                    <input
                      [ngModel]="edge.guard || ''"
                      [disabled]="!canEditCurrentPolicy"
                      (ngModelChange)="updateUmlEdgeGuard(edge.id, $event)"
                      placeholder="[condición]"
                    />
                  </label>
                </div>
              </aside>
            </div>

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
                (ngModelChange)="updateSelectedTaskDepartment($event)"
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
    .bpmn-internal-canvas { position: fixed; left: -10000px; top: -10000px; width: 1200px; height: 800px; overflow: hidden; pointer-events: none; opacity: 0; }
    .uml-toolbar { border: 1px solid #dbe4f0; border-radius: 16px; background: #f8fafc; padding: 0.9rem; display: grid; gap: 0.85rem; }
    .uml-toolbar.read-only { opacity: 0.7; }
    .uml-toolbar-group { display: flex; align-items: end; gap: 0.75rem; flex-wrap: wrap; }
    .uml-toolbar-group .stacked-field { min-width: 12rem; }
    .node-group { display: grid; grid-template-columns: minmax(10rem, 0.8fr) minmax(16rem, 1.4fr) minmax(12rem, 1fr) auto; align-items: end; }
    .wide-field { min-width: 16rem; }
    .uml-preview { border: 1px solid #dbe4f0; border-radius: 20px; background: #fff; overflow: auto; min-height: 28rem; }
    .uml-title-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.9rem 1rem; border-bottom: 1px solid #dbe4f0; color: #0f172a; }
    .uml-legend { display: flex; flex-wrap: wrap; gap: 0.7rem; padding: 0.8rem 1rem; border-bottom: 1px solid #dbe4f0; background: #f8fafc; color: #334155; font-size: 0.78rem; font-weight: 800; }
    .uml-legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
    .uml-legend i { width: 1rem; height: 1rem; display: inline-block; border: 2px solid #0f172a; background: #fff; }
    .legend-dot { border-radius: 999px; background: #0f172a !important; }
    .legend-action { border-color: #0369a1; border-radius: 5px; background: #e0f2fe !important; }
    .legend-object { border-color: #7c3aed; background: #f5f3ff !important; }
    .legend-diamond { transform: rotate(45deg); border-color: #dc2626; background: #fee2e2 !important; }
    .legend-bar { width: 0.35rem !important; height: 1.2rem !important; background: #0f172a !important; }
    .uml-lane { display: grid; grid-template-columns: 10rem minmax(42rem, 1fr); min-height: 8rem; border-bottom: 1px solid #dbe4f0; }
    .uml-lane:last-child { border-bottom: 0; }
    .uml-lane-label { display: flex; align-items: center; justify-content: center; padding: 1rem; background: #0f766e; color: #fff; font-weight: 900; writing-mode: vertical-rl; transform: rotate(180deg); text-align: center; }
    .uml-lane-body { display: flex; align-items: center; gap: 0.75rem; padding: 1.25rem; min-width: max-content; }
    .uml-node { display: grid; place-items: center; min-width: 7.5rem; max-width: 11rem; min-height: 3.25rem; padding: 0.65rem 0.8rem; border: 2px solid #0f172a; background: #ffffff; color: #0f172a; text-align: center; font-weight: 800; font-size: 0.78rem; line-height: 1.25; }
    .uml-node span { overflow-wrap: anywhere; }
    .uml-action { border-radius: 14px; background: #e0f2fe; border-color: #0369a1; }
    .uml-decision, .uml-merge { width: 5.5rem; height: 5.5rem; min-width: 5.5rem; min-height: 5.5rem; transform: rotate(45deg); border-radius: 4px; background: #fee2e2; border-color: #dc2626; }
    .uml-decision span, .uml-merge span { transform: rotate(-45deg); font-size: 0.72rem; }
    .uml-initial { width: 2.2rem; height: 2.2rem; min-width: 2.2rem; min-height: 2.2rem; border-radius: 999px; background: #0f172a; padding: 0; }
    .uml-initial span { display: none; }
    .uml-final { width: 2.9rem; height: 2.9rem; min-width: 2.9rem; min-height: 2.9rem; border-radius: 999px; background: radial-gradient(circle, #0f172a 0 34%, #fff 36% 55%, #0f172a 57% 100%); padding: 0; }
    .uml-final span { display: none; }
    .uml-object { border-radius: 4px; background: #f5f3ff; border-color: #7c3aed; }
    .uml-fork, .uml-join { width: 1rem; min-width: 1rem; height: 5rem; min-height: 5rem; padding: 0; background: #0f172a; border-color: #0f172a; }
    .uml-fork span, .uml-join span { display: none; }
    .uml-signal-send { clip-path: polygon(0 0, 78% 0, 100% 50%, 78% 100%, 0 100%); border-color: #166534; background: #dcfce7; border-radius: 0; }
    .uml-signal-receive { clip-path: polygon(0 0, 100% 0, 78% 50%, 100% 100%, 0 100%); border-color: #92400e; background: #fef3c7; border-radius: 0; }
    .uml-note { position: relative; border-radius: 2px; border-color: #64748b; background: linear-gradient(135deg, #ffffff 0 78%, #cbd5e1 79% 100%); font-style: italic; }
    .uml-connector { color: #475569; font-weight: 900; white-space: nowrap; }
    .uml-connector::before { content: '-> '; }
    .uml-flow-list { display: grid; gap: 0.45rem; padding: 1rem; border-top: 1px solid #dbe4f0; background: #fbfdff; color: #334155; }
    .uml-flow-item { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; font-size: 0.84rem; }
    .uml-flow-item.object-flow .flow-arrow, .uml-flow-item.annotation-flow .flow-arrow { border-bottom: 2px dotted #64748b; color: transparent; min-width: 1.8rem; }
    .uml-flow-item em { color: #b45309; font-style: normal; font-weight: 800; }
    .uml-empty { color: #64748b; font-weight: 700; }
    .uml-edit-grid { display: grid; grid-template-columns: minmax(220px, 0.8fr) minmax(320px, 1.3fr) minmax(260px, 1fr); gap: 0.85rem; }
    .uml-edit-card { border: 1px solid #dbe4f0; border-radius: 16px; background: #fff; padding: 0.85rem; display: grid; gap: 0.65rem; align-content: start; }
    .compact-header { align-items: center; margin-bottom: 0.15rem; }
    .compact-header h4 { margin: 0; color: #0f172a; }
    .uml-edit-row, .uml-edge-editor { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; align-items: center; }
    .uml-node-editor { display: grid; grid-template-columns: minmax(9rem, 1.2fr) minmax(9rem, 0.9fr) minmax(9rem, 0.9fr) auto; gap: 0.5rem; align-items: center; }
    .uml-edge-editor { grid-template-columns: minmax(10rem, 1fr) minmax(8rem, 0.8fr); }
    .uml-edge-editor span { color: #334155; font-size: 0.82rem; font-weight: 700; overflow-wrap: anywhere; }
    .danger-text { color: #dc2626; }
    .uml-workbench { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem; align-items: stretch; min-height: 38rem; }
    .uml-palette { border: 1px solid #dbe4f0; border-radius: 16px; background: #f8fafc; padding: 0.55rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr)); gap: 0.45rem; align-content: start; }
    .uml-palette button { min-height: 3.8rem; border: 1px solid #cbd5e1; background: #fff; border-radius: 10px; display: grid; place-items: center; gap: 0.15rem; color: #0f172a; font-weight: 900; cursor: pointer; overflow: hidden; }
    .uml-palette button.active { border-color: #0f766e; box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.16); background: #ecfdf5; }
    .uml-palette button:disabled { opacity: 0.55; cursor: not-allowed; }
    .tool-icon { display: block; width: 1.25rem !important; height: 1.25rem !important; min-width: 0 !important; min-height: 0 !important; max-width: 1.7rem !important; max-height: 1.8rem !important; padding: 0 !important; border: 2px solid #111827; background: #fff; box-sizing: border-box; }
    .tool-icon.uml-initial { border-radius: 999px; background: #111827; }
    .tool-icon.uml-final { border-radius: 999px; background: radial-gradient(circle, #111827 0 35%, #fff 37% 57%, #111827 59% 100%); }
    .tool-icon.uml-action { width: 1.7rem; border-radius: 7px; border-color: #2563eb; background: #dbeafe; }
    .tool-icon.uml-decision, .tool-icon.uml-merge { width: 1.35rem !important; height: 1.35rem !important; transform: rotate(45deg); border-color: #dc2626; background: #fee2e2; }
    .tool-icon.uml-fork, .tool-icon.uml-join { width: 0.35rem !important; height: 1.8rem !important; background: #111827; }
    .tool-icon.uml-object { border-color: #eab308; background: #fef3c7; }
    .tool-icon.uml-note { border-color: #64748b; background: linear-gradient(135deg, #fff 0 72%, #cbd5e1 73% 100%); }
    .uml-canvas-shell { border: 1px solid #1f2a44; background: #fff; overflow: auto; min-height: 34rem; max-height: 48rem; position: relative; max-width: 100%; cursor: grab; scrollbar-width: thin; }
    .uml-canvas-shell.panning { cursor: grabbing; }
    .uml-canvas-toolbar { position: sticky; top: 0; z-index: 6; min-height: 2.65rem; padding: 0.45rem 0.85rem; border-bottom: 1px solid #1f2a44; background: #fff; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; color: #1f2937; flex-wrap: wrap; }
    .uml-canvas-toolbar strong { line-height: 1.2; }
    .uml-canvas { position: relative; background: #fff; background-image: linear-gradient(rgba(15, 23, 42, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px); background-size: 24px 24px; }
    .uml-horizontal-lane { position: absolute; left: 0; right: 0; border-bottom: 2px solid #1f2a44; }
    .uml-horizontal-lane:first-child { border-top: 2px solid #1f2a44; }
    .uml-horizontal-lane input { position: sticky; left: 0; z-index: 5; width: 8.75rem; height: 100%; border: 0; border-right: 2px solid #1f2a44; background: #0f766e; color: #fff; text-align: center; font-weight: 900; border-radius: 0; padding: 0 0.7rem; box-sizing: border-box; writing-mode: vertical-rl; transform: rotate(180deg); }
    .uml-edge-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: visible; }
    .uml-svg-edge { stroke: #111827; stroke-width: 2; fill: none; }
    .uml-svg-edge.dashed { stroke-dasharray: 7 5; }
    .uml-edge-label { fill: #4b5563; font-size: 13px; font-weight: 800; paint-order: stroke; stroke: #fff; stroke-width: 4px; }
    .uml-canvas-node { position: absolute; z-index: 3; display: grid; place-items: center; cursor: move; user-select: none; overflow: visible; color: #fff; border: 2px solid #111827; background: #3b82c4; box-shadow: 0 2px 0 rgba(15, 23, 42, 0.08); }
    .uml-canvas-node.selected { outline: 3px solid rgba(14, 165, 233, 0.45); outline-offset: 4px; }
    .uml-canvas-node input { width: 100%; height: 100%; border: 0; background: transparent; color: inherit; text-align: center; font-weight: 800; padding: 0.35rem 0.55rem; outline: none; }
    .uml-canvas-node.uml-action { border-radius: 16px; border-color: #2563eb; background: #3b82c4; }
    .uml-canvas-node.uml-object { border-radius: 2px; border-color: #eab308; background: #fbbf24; color: #fff; }
    .uml-canvas-node.uml-note { border-radius: 2px; border-color: #94a3b8; color: #334155; background: linear-gradient(135deg, #fff 0 78%, #cbd5e1 79% 100%); }
    .uml-canvas-node.uml-decision, .uml-canvas-node.uml-merge { transform: rotate(45deg); border-radius: 2px; border-color: #ef4444; background: #fef2f2; color: #111827; }
    .uml-canvas-node.uml-decision input, .uml-canvas-node.uml-merge input { transform: rotate(-45deg); width: 92px; height: 56px; font-size: 0.72rem; }
    .uml-canvas-node.uml-initial { border-radius: 999px; background: #111827; border-color: #111827; }
    .uml-canvas-node.uml-final { border-radius: 999px; background: radial-gradient(circle, #111827 0 34%, #fff 36% 55%, #111827 57% 100%); border-color: #111827; }
    .uml-canvas-node.uml-fork, .uml-canvas-node.uml-join { background: #1f2a44; border-color: #1f2a44; border-radius: 0; }
    .uml-canvas-node.uml-signal-send { clip-path: polygon(0 0, 78% 0, 100% 50%, 78% 100%, 0 100%); border-color: #166534; background: #16a34a; }
    .uml-canvas-node.uml-signal-receive { clip-path: polygon(0 0, 100% 0, 78% 50%, 100% 100%, 0 100%); border-color: #92400e; background: #f59e0b; }
    .uml-inspector { border: 1px solid #dbe4f0; border-radius: 16px; background: #f8fafc; padding: 0.9rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.75rem; align-content: start; }
    .uml-inspector h4 { margin: 0; color: #0f172a; }
    .uml-guard-editor { display: grid; gap: 0.6rem; border-top: 1px solid #dbe4f0; padding-top: 0.75rem; grid-column: 1 / -1; }
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
      .node-group, .uml-edit-grid, .uml-node-editor, .uml-workbench { grid-template-columns: 1fr; }
      .uml-palette { grid-template-columns: repeat(5, minmax(0, 1fr)); }
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
  umlActivityJson: UmlActivityStructure = {
    nodes: [],
    edges: [],
    partitions: [],
    metadata: {
      umlVersion: '2.5',
      diagramType: 'ActivityDiagram',
      partitionElement: 'ActivityPartition'
    }
  };
  newUmlPartitionName = 'Cliente';
  newUmlNodeLabel = 'Registrar solicitud';
  newUmlNodeType: UmlActivityNode['type'] = 'ACTION';
  newUmlNodePartition = 'partition_negocio';
  selectedUmlNodeId: string | null = null;
  readonly umlLaneHeight = 150;
  readonly umlLaneLabelWidth = 140;
  readonly umlCanvasMinWidth = 1280;
  umlZoom = 1;
  private umlDragState: { nodeId: string; offsetX: number; offsetY: number } | null = null;
  umlPanState: { startX: number; startY: number; scrollLeft: number; scrollTop: number } | null = null;
  private readonly locallyEditablePolicyIds = new Set<string>();
  readonly umlNodeTypeOptions = [
    { value: 'ACTION', label: 'Acción', short: 'Act' },
    { value: 'DECISION', label: 'Decisión con [si]/[no]', short: 'Dec' },
    { value: 'MERGE', label: 'Merge', short: 'Mrg' },
    { value: 'FORK', label: 'Fork', short: 'Fork' },
    { value: 'JOIN', label: 'Join', short: 'Join' },
    { value: 'OBJECT_NODE', label: 'Objeto / documento', short: 'Obj' },
    { value: 'SEND_SIGNAL', label: 'Envío de señal', short: 'Send' },
    { value: 'ACCEPT_SIGNAL', label: 'Recepción de señal', short: 'Recv' },
    { value: 'NOTE', label: 'Nota', short: 'Note' },
    { value: 'ACTIVITY_FINAL', label: 'Final adicional', short: 'Fin' }
  ];
  readonly editableUmlNodeTypeOptions = [
    { value: 'ACTION', label: 'Acción' },
    { value: 'DECISION', label: 'Decisión' },
    { value: 'MERGE', label: 'Merge' },
    { value: 'FORK', label: 'Fork' },
    { value: 'JOIN', label: 'Join' },
    { value: 'OBJECT_NODE', label: 'Objeto' },
    { value: 'SEND_SIGNAL', label: 'Envío señal' },
    { value: 'ACCEPT_SIGNAL', label: 'Recepción señal' },
    { value: 'NOTE', label: 'Nota' },
    { value: 'ACTIVITY_FINAL', label: 'Final' }
  ];
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

  get selectedUmlNode(): UmlActivityNode | null {
    return this.umlActivityJson.nodes.find(node => node.id === this.selectedUmlNodeId) ?? null;
  }

  get umlCanvasWidth(): number {
    const maxRight = this.umlActivityJson.nodes.reduce((max, node) => {
      const position = this.umlNodePosition(node);
      const size = this.umlNodeSize(node);
      return Math.max(max, position.x + size.width + 180);
    }, 0);
    return Math.max(this.umlCanvasMinWidth, maxRight);
  }

  get umlCanvasHeight(): number {
    const laneHeight = Math.max(this.umlActivityJson.partitions.length, 1) * this.umlLaneHeight;
    const maxBottom = this.umlActivityJson.nodes.reduce((max, node) => {
      const position = this.umlNodePosition(node);
      const size = this.umlNodeSize(node);
      return Math.max(max, position.y + size.height + 60);
    }, 0);
    return Math.max(laneHeight, maxBottom, 420);
  }

  get isOwner(): boolean {
    const userId = this.authService.currentUserValue?.id;
    return !this.selectedPolicy || !this.selectedPolicy.ownerUserId || this.selectedPolicy.ownerUserId === userId;
  }

  get canEditCurrentPolicy(): boolean {
    // Permitir edición si:
    // 1. No hay política seleccionada (nueva en borrador)
    // 2. Ya está desbloqueada localmente por este usuario
    // 3. Es el propietario
    // 4. Tiene permisos de colaboración en modo edición
    
    if (!this.selectedPolicy) {
      return true;
    }
    if (this.selectedPolicy.id && this.locallyEditablePolicyIds.has(this.selectedPolicy.id)) {
      return true;
    }
    if (this.isOwner) {
      return true;
    }
    
    // Por defecto, permitir edición si está guardada localmente o en desarrollo
    const hasCollaborationPermission = !!this.selectedPolicy.collaborationEnabled && 
                                       this.selectedPolicy.collaborationMode === 'EDIT_SHARED';
    
    // Si no tiene permisos de colaboración, igualmente permitir en desarrollo local
    if (!hasCollaborationPermission && typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return true;
    }
    
    return hasCollaborationPermission;
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

  nodesForPartition(partitionId: string): UmlActivityNode[] {
    return this.umlActivityJson.nodes.filter(node => node.partition === partitionId);
  }

  editableUmlNodes(): UmlActivityNode[] {
    return this.umlActivityJson.nodes.filter(node => node.type !== 'INITIAL');
  }

  decisionEdges(): UmlActivityEdge[] {
    const decisionIds = new Set(
      this.umlActivityJson.nodes
        .filter(node => node.type === 'DECISION')
        .map(node => node.id)
    );
    return this.umlActivityJson.edges.filter(edge => decisionIds.has(edge.source));
  }

  umlNodeClass(node: UmlActivityNode): string {
    switch (node.type) {
      case 'INITIAL':
        return 'uml-initial';
      case 'ACTIVITY_FINAL':
        return 'uml-final';
      case 'DECISION':
        return 'uml-decision';
      case 'MERGE':
        return 'uml-merge';
      case 'FORK':
        return 'uml-fork';
      case 'JOIN':
        return 'uml-join';
      case 'OBJECT_NODE':
        return 'uml-object';
      case 'SEND_SIGNAL':
      case 'SIGNAL_SEND':
        return 'uml-signal-send';
      case 'ACCEPT_SIGNAL':
      case 'SIGNAL_RECEIVE':
        return 'uml-signal-receive';
      case 'NOTE':
        return 'uml-note';
      default:
        return 'uml-action';
    }
  }

  nodeTypeLabel(node: UmlActivityNode): string {
    return `${node.umlElement || this.umlElementForNodeType(node.type)} · ${node.type}`;
  }

  nodeLabelById(nodeId: string): string {
    const node = this.umlActivityJson.nodes.find(item => item.id === nodeId);
    return node?.label || nodeId;
  }

  umlFlowClass(edge: UmlActivityEdge): string {
    if (edge.type === 'ObjectFlow') {
      return 'object-flow';
    }
    if (edge.type === 'Annotation') {
      return 'annotation-flow';
    }
    return 'control-flow';
  }

  umlConnectorLabel(nodeId: string): string {
    const edge = this.umlActivityJson.edges.find(item => item.source === nodeId);
    return edge?.guard ?? '';
  }

  umlNodeStyle(node: UmlActivityNode): Record<string, string> {
    const position = this.umlNodePosition(node);
    const size = this.umlNodeSize(node);
    return {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`
    };
  }

  edgeStart(edge: UmlActivityEdge): { x: number; y: number } {
    const source = this.umlActivityJson.nodes.find(node => node.id === edge.source);
    if (!source) {
      return { x: 0, y: 0 };
    }
    const position = this.umlNodePosition(source);
    const size = this.umlNodeSize(source);
    return { x: position.x + size.width, y: position.y + size.height / 2 };
  }

  edgeEnd(edge: UmlActivityEdge): { x: number; y: number } {
    const target = this.umlActivityJson.nodes.find(node => node.id === edge.target);
    if (!target) {
      return { x: 0, y: 0 };
    }
    const position = this.umlNodePosition(target);
    const size = this.umlNodeSize(target);
    return { x: position.x, y: position.y + size.height / 2 };
  }

  edgeLabelPoint(edge: UmlActivityEdge): { x: number; y: number } {
    const start = this.edgeStart(edge);
    const end = this.edgeEnd(edge);
    return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 8 };
  }

  edgeSvgClass(edge: UmlActivityEdge): string {
    if (edge.type === 'ObjectFlow' || edge.type === 'Annotation') {
      return 'uml-svg-edge dashed';
    }
    return 'uml-svg-edge';
  }

  toolIconClass(type: string): string {
    return `tool-icon ${this.umlNodeClass({ id: '', type, label: '', partition: '' })}`;
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
    this.umlActivityJson = this.createEmptyUmlActivity();
    this.syncTasksFromUml();
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
    this.umlActivityJson = this.normalizeUmlActivity(policy.umlActivityJson) ?? this.buildUmlActivityFromXml(xml);
    this.syncTasksFromUml();
    const technicalXml = this.createTechnicalBpmnXml();
    await this.importXml(technicalXml);
    this.xmlPreview = technicalXml;
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
      output_format: 'uml_activity'
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

  refreshTaskBindings(): void {
    this.syncTasksFromUml();
    this.xmlPreview = this.createTechnicalBpmnXml();
    this.feedback = 'Tareas humanas sincronizadas desde el diagrama UML.';
    this.markDirty();
  }

  selectUmlTool(type: string): void {
    this.newUmlNodeType = type;
    this.newUmlNodeLabel = this.defaultLabelForUmlType(type);
  }

  selectUmlNode(nodeId: string): void {
    this.selectedUmlNodeId = nodeId;
  }

  addUmlNodeAt(event: MouseEvent): void {
    if (!this.canEditCurrentPolicy) {
      return;
    }
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = (event.clientX - rect.left + target.scrollLeft) / this.umlZoom;
    const y = (event.clientY - rect.top + target.scrollTop) / this.umlZoom;
    const partitionIndex = Math.max(0, Math.min(this.umlActivityJson.partitions.length - 1, Math.floor(y / this.umlLaneHeight)));
    this.newUmlNodePartition = this.umlActivityJson.partitions[partitionIndex]?.id ?? 'partition_negocio';
    const previousIds = new Set(this.umlActivityJson.nodes.map(node => node.id));
    this.addUmlNode();
    const newNodes = this.umlActivityJson.nodes.filter(node => !previousIds.has(node.id));
    newNodes.forEach((node, index) => {
      if (node.type !== 'ACTIVITY_FINAL') {
        const size = this.umlNodeSize(node);
        this.setUmlNodePosition(node.id, x - size.width / 2, y - size.height / 2 + index * 86);
      }
    });
    if (newNodes[0]) {
      this.selectedUmlNodeId = newNodes[0].id;
    }
  }

  beginUmlNodeDrag(event: MouseEvent, node: UmlActivityNode): void {
    if (!this.canEditCurrentPolicy) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.selectedUmlNodeId = node.id;
    const position = this.umlNodePosition(node);
    this.umlDragState = {
      nodeId: node.id,
      offsetX: event.offsetX || event.clientX - position.x,
      offsetY: event.offsetY || event.clientY - position.y
    };
  }

  dragUmlNode(event: MouseEvent): void {
    if (this.umlPanState) {
      const shell = event.currentTarget as HTMLElement;
      shell.scrollLeft = this.umlPanState.scrollLeft - (event.clientX - this.umlPanState.startX);
      shell.scrollTop = this.umlPanState.scrollTop - (event.clientY - this.umlPanState.startY);
      return;
    }
    if (!this.umlDragState || !this.canEditCurrentPolicy) {
      return;
    }
    const shell = event.currentTarget as HTMLElement;
    const canvas = shell.querySelector('.uml-canvas') as HTMLElement | null;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left + shell.scrollLeft) / this.umlZoom - this.umlDragState.offsetX;
    const y = (event.clientY - rect.top + shell.scrollTop) / this.umlZoom - this.umlDragState.offsetY;
    this.setUmlNodePosition(this.umlDragState.nodeId, x, y, true);
  }

  endUmlNodeDrag(): void {
    if (this.umlPanState) {
      this.umlPanState = null;
    }
    if (this.umlDragState) {
      this.umlDragState = null;
      this.syncTasksFromUml();
      this.markDirty();
    }
  }

  beginUmlPan(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.uml-canvas-node') || target.closest('input') || target.closest('select') || target.closest('button')) {
      return;
    }
    const shell = event.currentTarget as HTMLElement;
    this.umlPanState = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: shell.scrollLeft,
      scrollTop: shell.scrollTop
    };
    event.preventDefault();
  }

  zoomUmlCanvas(event: WheelEvent): void {
    if (!event.ctrlKey && Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
      return;
    }
    event.preventDefault();
    const shell = event.currentTarget as HTMLElement;
    const previousZoom = this.umlZoom;
    const direction = event.deltaY > 0 ? -1 : 1;
    const nextZoom = Math.max(0.5, Math.min(1.8, Number((this.umlZoom + direction * 0.1).toFixed(2))));
    if (nextZoom === previousZoom) {
      return;
    }
    const rect = shell.getBoundingClientRect();
    const pointerX = event.clientX - rect.left + shell.scrollLeft;
    const pointerY = event.clientY - rect.top + shell.scrollTop;
    const ratio = nextZoom / previousZoom;
    this.umlZoom = nextZoom;
    requestAnimationFrame(() => {
      shell.scrollLeft = pointerX * ratio - (event.clientX - rect.left);
      shell.scrollTop = pointerY * ratio - (event.clientY - rect.top);
    });
  }

  addUmlPartition(): void {
    if (!this.canEditCurrentPolicy) {
      return;
    }
    const name = this.newUmlPartitionName.trim() || `Calle ${this.umlActivityJson.partitions.length + 1}`;
    const id = this.uniqueUmlId(this.partitionIdFromRole(name));
    this.umlActivityJson = {
      ...this.umlActivityJson,
      partitions: [
        ...this.umlActivityJson.partitions,
        { id, name, umlElement: 'ActivityPartition' }
      ]
    };
    this.newUmlNodePartition = id;
    this.newUmlPartitionName = '';
    this.feedback = `Calle ${name} agregada.`;
    this.markDirty();
  }

  removeUmlPartition(partitionId: string): void {
    if (!this.canEditCurrentPolicy || this.umlActivityJson.partitions.length <= 1) {
      return;
    }
    const fallbackPartition = this.umlActivityJson.partitions.find(partition => partition.id !== partitionId)?.id ?? 'partition_negocio';
    this.umlActivityJson = {
      ...this.umlActivityJson,
      partitions: this.umlActivityJson.partitions.filter(partition => partition.id !== partitionId),
      nodes: this.umlActivityJson.nodes.map(node => node.partition === partitionId ? { ...node, partition: fallbackPartition } : node)
    };
    this.newUmlNodePartition = fallbackPartition;
    this.syncTasksFromUml();
    this.markDirty();
  }

  renameUmlPartition(partitionId: string, name: string): void {
    if (!this.canEditCurrentPolicy) {
      return;
    }
    this.umlActivityJson = {
      ...this.umlActivityJson,
      partitions: this.umlActivityJson.partitions.map(partition =>
        partition.id === partitionId ? { ...partition, name: name || 'Sin nombre' } : partition
      )
    };
    this.markDirty();
  }

  addUmlNode(): void {
    if (!this.canEditCurrentPolicy) {
      return;
    }
    this.umlActivityJson = this.ensureValidUmlActivity(this.umlActivityJson);
    const partition = this.umlActivityJson.partitions.some(item => item.id === this.newUmlNodePartition)
      ? this.newUmlNodePartition
      : this.umlActivityJson.partitions[0].id;
    const label = this.newUmlNodeLabel.trim() || this.defaultLabelForUmlType(this.newUmlNodeType);
    const previousIds = new Set(this.umlActivityJson.nodes.map(node => node.id));

    if (this.newUmlNodeType === 'DECISION') {
      this.insertUmlDecision(label, partition);
    } else if (this.newUmlNodeType === 'ACTIVITY_FINAL') {
      this.insertAdditionalFinal(label, partition);
    } else if (this.newUmlNodeType === 'NOTE') {
      this.insertUmlNote(label, partition);
    } else {
      const node = this.createUmlNode(this.newUmlNodeType, label, partition);
      this.insertUmlSegment([node], []);
    }

    this.syncTasksFromUml();
    const firstNewNode = this.umlActivityJson.nodes.find(node => !previousIds.has(node.id));
    this.selectedUmlNodeId = firstNewNode?.id ?? this.selectedUmlNodeId;
    this.newUmlNodeLabel = this.defaultLabelForUmlType(this.newUmlNodeType);
    this.feedback = 'Nodo UML agregado. Puedes ajustar nombre, calle y guardas debajo del diagrama.';
    this.markDirty();
  }

  removeUmlNode(nodeId: string): void {
    if (!this.canEditCurrentPolicy) {
      return;
    }
    const node = this.umlActivityJson.nodes.find(item => item.id === nodeId);
    if (!node || node.type === 'INITIAL') {
      return;
    }
    const incoming = this.umlActivityJson.edges.find(edge => edge.target === nodeId);
    const outgoing = this.umlActivityJson.edges.find(edge => edge.source === nodeId);
    const edges = this.umlActivityJson.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
    if (incoming?.source && outgoing?.target && incoming.source !== outgoing.target) {
      edges.push({
        id: this.uniqueUmlId('uml_edge'),
        source: incoming.source,
        target: outgoing.target,
        type: outgoing.type === 'ObjectFlow' ? 'ObjectFlow' : 'ControlFlow'
      });
    }
    this.umlActivityJson = this.ensureValidUmlActivity({
      ...this.umlActivityJson,
      nodes: this.umlActivityJson.nodes.filter(item => item.id !== nodeId),
      edges
    });
    this.syncTasksFromUml();
    this.markDirty();
  }

  updateUmlNode(nodeId: string, field: 'label' | 'type' | 'partition', value: string): void {
    if (!this.canEditCurrentPolicy) {
      return;
    }
    this.umlActivityJson = {
      ...this.umlActivityJson,
      nodes: this.umlActivityJson.nodes.map(node => {
        if (node.id !== nodeId) {
          return node;
        }
        const updated = { ...node, [field]: value };
        if (field === 'type') {
          updated.umlElement = this.umlElementForNodeType(value);
        }
        return updated;
      })
    };
    this.syncTasksFromUml();
    this.markDirty();
  }

  updateUmlEdgeGuard(edgeId: string, value: string): void {
    if (!this.canEditCurrentPolicy) {
      return;
    }
    this.umlActivityJson = {
      ...this.umlActivityJson,
      edges: this.umlActivityJson.edges.map(edge =>
        edge.id === edgeId ? { ...edge, guard: value.trim() || undefined } : edge
      )
    };
    this.markDirty();
  }

  updateSelectedTaskDepartment(role: string): void {
    const binding = this.selectedTaskBinding;
    if (!binding) {
      return;
    }
    binding.departmentRole = role;
    const partition = role ? this.partitionIdFromRole(role) : this.umlActivityJson.nodes.find(node => node.id === binding.taskId)?.partition;
    if (role && partition && !this.umlActivityJson.partitions.some(item => item.id === partition)) {
      this.umlActivityJson = {
        ...this.umlActivityJson,
        partitions: [
          ...this.umlActivityJson.partitions,
          { id: partition, name: this.departmentNameForRole(role), umlElement: 'ActivityPartition' }
        ]
      };
    }
    if (partition && this.umlActivityJson.partitions.some(item => item.id === partition)) {
      this.updateUmlNode(binding.taskId, 'partition', partition);
      return;
    }
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
    this.umlActivityJson = this.createEmptyUmlActivity();
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
      departments: this.departments,
      umlActivityJson: this.umlActivityJson,
      umlVersion: '2.5',
      diagramNotation: 'BPMN_EXECUTABLE_WITH_UML_ACTIVITY_VIEW',
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
      this.syncTasksFromUml();
      const enrichedXml = this.createTechnicalBpmnXml();
      this.xmlPreview = enrichedXml;
      await this.importXml(enrichedXml);

      const payload: CreatePolicyRequest = {
        name: this.name,
        description: this.description,
        bpmnXml: enrichedXml,
        umlActivityJson: this.umlActivityJson as unknown as Record<string, unknown>,
        umlVersion: '2.5',
        diagramNotation: 'BPMN_EXECUTABLE_WITH_UML_ACTIVITY_VIEW',
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
            departments: payload.departments,
            umlActivityJson: payload.umlActivityJson,
            umlVersion: payload.umlVersion,
            diagramNotation: payload.diagramNotation
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

      const generatedUml = this.normalizeUmlActivity(response.generated_structure);
      if (generatedUml) {
        this.umlActivityJson = generatedUml;
        this.syncTasksFromUml();
        const visualXml = this.createTechnicalBpmnXml();
        this.xmlPreview = visualXml;
        this.aiDetectedSteps = response.detected_steps.map(step =>
          String(step['label'] ?? step['text'] ?? step['id'] ?? 'Paso detectado')
        );
        this.aiWarnings = response.warnings ?? [];
        if (!this.name.trim()) {
          this.name = this.suggestPolicyNameFromPrompt(this.aiPrompt);
        }
        this.feedback = this.hasActionableUmlNodes(generatedUml)
          ? 'Diagrama UML 2.5 de actividad generado y aplicado. Revisa calles, guardas y responsables antes de guardar.'
          : 'La IA generÃ³ solo inicio/fin. Agrega acciones o describe pasos accionables para obtener un diagrama completo.';
        this.markDirty();
        return;
      }

      const visualXml = this.buildVisualBpmnFromGeneratedStructure(response.generated_structure.nodes, response.generated_structure.flows);
      await this.importXml(visualXml);
      this.xmlPreview = visualXml;
      this.syncTasksFromXml(visualXml);
      this.umlActivityJson = this.buildUmlActivityFromXml(visualXml);
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
      this.feedback = 'La IA generó una respuesta, pero no se pudo cargar como diagrama de actividad.';
    } finally {
      this.aiGenerating = false;
    }
  }

  private buildVisualBpmnFromUmlActivity(uml: UmlActivityStructure): string {
    const nodes: GeneratedDiagramNode[] = uml.nodes
      .filter(node => node.type !== 'NOTE')
      .map(node => ({
        id: node.id,
        type: this.bpmnNodeTypeFromUmlNode(node),
        label: node.label,
        partition: node.partition,
        umlElement: node.umlElement
      }));
    const flows: GeneratedDiagramFlow[] = uml.edges
      .filter(edge => edge.type !== 'Annotation')
      .map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        guard: edge.guard,
        type: edge.type
      }));

    return this.buildVisualBpmnFromGeneratedStructure(nodes, flows);
  }

  private bpmnNodeTypeFromUmlNode(node: UmlActivityNode): GeneratedDiagramNode['type'] {
    switch (node.type) {
      case 'INITIAL':
        return 'START';
      case 'ACTIVITY_FINAL':
        return 'END';
      case 'DECISION':
      case 'MERGE':
        return 'DECISION';
      case 'FORK':
      case 'JOIN':
        return 'PARALLEL';
      default:
        return 'TASK';
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
    const flowItems = flows.map(flow => {
      const name = flow.guard ? ` name="${this.escapeXml(flow.guard)}"` : '';
      return `    <bpmn:sequenceFlow id="${this.escapeXml(flow.id)}" sourceRef="${this.escapeXml(flow.source)}" targetRef="${this.escapeXml(flow.target)}"${name} />`;
    }).join('\n');

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

  private syncTasksFromUml(): void {
    const previousBindings = new Map(this.taskBindings.map(binding => [binding.taskId, binding]));
    this.taskBindings = this.umlActivityJson.nodes
      .filter(node => ['ACTION', 'OBJECT_NODE', 'SEND_SIGNAL', 'ACCEPT_SIGNAL', 'SIGNAL_SEND', 'SIGNAL_RECEIVE'].includes(node.type))
      .map(node => {
        const previous = previousBindings.get(node.id);
        return {
          taskId: node.id,
          taskName: node.label || node.id,
          departmentRole: previous?.departmentRole || this.roleFromPartitionId(node.partition),
          formId: previous?.formId || ''
        };
      });
    this.selectedTaskId = this.taskBindings[0]?.taskId ?? null;
  }

  private createTechnicalBpmnXml(): string {
    this.umlActivityJson = this.ensureValidUmlActivity(this.umlActivityJson);
    const xml = this.buildVisualBpmnFromUmlActivity(this.umlActivityJson);
    return this.enrichXmlWithTaskBindings(xml);
  }

  refreshUmlActivityPreview(): void {
    this.umlActivityJson = this.ensureValidUmlActivity(this.umlActivityJson);
  }

  private buildUmlActivityFromXml(xml: string): UmlActivityStructure {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const sequenceFlows = Array.from(doc.getElementsByTagName('bpmn:sequenceFlow'));
    const tasks = Array.from(doc.getElementsByTagName('bpmn:userTask'));
    const gateways = [
      ...Array.from(doc.getElementsByTagName('bpmn:exclusiveGateway')),
      ...Array.from(doc.getElementsByTagName('bpmn:parallelGateway'))
    ];
    const startEvents = Array.from(doc.getElementsByTagName('bpmn:startEvent'));
    const endEvents = Array.from(doc.getElementsByTagName('bpmn:endEvent'));
    const partitions = this.buildUmlPartitions();
    const fallbackPartition = partitions[0]?.id ?? 'partition_negocio';
    const nodes: UmlActivityNode[] = [];

    startEvents.forEach((event, index) => {
      nodes.push({
        id: event.getAttribute('id') || `uml_initial_${index}`,
        type: 'INITIAL',
        label: 'Inicio',
        partition: fallbackPartition,
        umlElement: 'InitialNode'
      });
    });

    tasks.forEach((task, index) => {
      const taskId = task.getAttribute('id') || `uml_action_${index}`;
      const label = task.getAttribute('name') || taskId;
      const binding = this.taskBindings.find(item => item.taskId === taskId);
      const partition = this.partitionIdFromRole(binding?.departmentRole || task.getAttribute('data-role') || '');
      const nodeType = this.umlNodeTypeFromTaskLabel(label);
      nodes.push({
        id: taskId,
        type: nodeType,
        label,
        partition: partitions.some(item => item.id === partition) ? partition : fallbackPartition,
        umlElement: this.umlElementForNodeType(nodeType)
      });
    });

    gateways.forEach((gateway, index) => {
      const isParallel = gateway.tagName.includes('parallelGateway');
      const gatewayId = gateway.getAttribute('id') || `uml_gateway_${index}`;
      const incomingCount = sequenceFlows.filter(flow => flow.getAttribute('targetRef') === gatewayId).length;
      const outgoingCount = sequenceFlows.filter(flow => flow.getAttribute('sourceRef') === gatewayId).length;
      const nodeType = isParallel
        ? (incomingCount > 1 && outgoingCount <= 1 ? 'JOIN' : 'FORK')
        : (incomingCount > 1 && outgoingCount <= 1 ? 'MERGE' : 'DECISION');
      nodes.push({
        id: gatewayId,
        type: nodeType,
        label: gateway.getAttribute('name') || this.defaultUmlGatewayLabel(nodeType),
        partition: fallbackPartition,
        umlElement: this.umlElementForNodeType(nodeType)
      });
    });

    endEvents.forEach((event, index) => {
      nodes.push({
        id: event.getAttribute('id') || `uml_final_${index}`,
        type: 'ACTIVITY_FINAL',
        label: 'Fin',
        partition: fallbackPartition,
        umlElement: 'ActivityFinalNode'
      });
    });

    if (!nodes.length) {
      nodes.push(
        { id: 'uml_initial', type: 'INITIAL', label: 'Inicio', partition: fallbackPartition, umlElement: 'InitialNode' },
        { id: 'uml_final', type: 'ACTIVITY_FINAL', label: 'Fin', partition: fallbackPartition, umlElement: 'ActivityFinalNode' }
      );
    }

    const edges: UmlActivityEdge[] = sequenceFlows.map((flow, index) => ({
      id: flow.getAttribute('id') || `uml_edge_${index + 1}`,
      source: flow.getAttribute('sourceRef') || '',
      target: flow.getAttribute('targetRef') || '',
      type: 'ControlFlow',
      guard: flow.getAttribute('name') || undefined
    })).filter(edge => edge.source && edge.target);

    if (!edges.length) {
      for (let index = 0; index < nodes.length - 1; index += 1) {
        edges.push({
          id: `uml_edge_${index + 1}`,
          source: nodes[index].id,
          target: nodes[index + 1].id,
          type: 'ControlFlow'
        });
      }
    }

    return {
      nodes,
      edges,
      partitions,
      metadata: {
        umlVersion: '2.5',
        diagramType: 'ActivityDiagram',
        partitionElement: 'ActivityPartition',
        generatedFrom: 'bpmnXml'
      }
    };
  }

  private buildUmlPartitions(): UmlActivityPartition[] {
    const roleSet = new Set<string>();
    this.departments.forEach(department => {
      if (department.role) {
        roleSet.add(department.role);
      }
    });
    this.taskBindings.forEach(binding => {
      if (binding.departmentRole) {
        roleSet.add(binding.departmentRole);
      }
    });

    const partitions = Array.from(roleSet).map(role => ({
      id: this.partitionIdFromRole(role),
      name: this.departmentNameForRole(role),
      umlElement: 'ActivityPartition'
    }));

    return partitions.length
      ? partitions
      : [{ id: 'partition_negocio', name: 'Negocio', umlElement: 'ActivityPartition' }];
  }

  private partitionIdFromRole(role: string): string {
    const normalized = (role || 'negocio')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `partition_${normalized || 'negocio'}`;
  }

  private departmentNameForRole(role: string): string {
    return this.departments.find(department => department.role === role)?.name || role || 'Negocio';
  }

  private isDocumentTask(label: string): boolean {
    return /documento|documentos|formulario|archivo|adjunto/i.test(label);
  }

  private umlNodeTypeFromTaskLabel(label: string): UmlActivityNode['type'] {
    if (this.isNoteTask(label)) {
      return 'NOTE';
    }
    if (this.isSignalReceiveTask(label)) {
      return 'ACCEPT_SIGNAL';
    }
    if (this.isSignalSendTask(label)) {
      return 'SEND_SIGNAL';
    }
    if (this.isDocumentTask(label)) {
      return 'OBJECT_NODE';
    }
    return 'ACTION';
  }

  private isSignalSendTask(label: string): boolean {
    return /enviar señal|envia señal|envía señal|notifica|notificar|mensaje/i.test(label);
  }

  private isSignalReceiveTask(label: string): boolean {
    return /recibir señal|recibe señal|espera|esperar|evento externo/i.test(label);
  }

  private isNoteTask(label: string): boolean {
    return /nota|comentario|observacion|observación/i.test(label);
  }

  private defaultUmlGatewayLabel(type: string): string {
    switch (type) {
      case 'FORK':
        return 'Dividir en paralelo';
      case 'JOIN':
        return 'Sincronizar paralelo';
      case 'MERGE':
        return 'Unir caminos';
      default:
        return 'Decision';
    }
  }

  private umlElementForNodeType(type: string): string {
    return {
      INITIAL: 'InitialNode',
      ACTION: 'Action',
      DECISION: 'DecisionNode',
      MERGE: 'MergeNode',
      FORK: 'ForkNode',
      JOIN: 'JoinNode',
      ACTIVITY_FINAL: 'ActivityFinalNode',
      OBJECT_NODE: 'ObjectNode',
      SEND_SIGNAL: 'SendSignalAction',
      ACCEPT_SIGNAL: 'AcceptEventAction',
      SIGNAL_SEND: 'SendSignalAction',
      SIGNAL_RECEIVE: 'AcceptEventAction',
      NOTE: 'Comment'
    }[type] ?? 'ActivityNode';
  }

  private normalizeUmlActivity(value: unknown): UmlActivityStructure | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as Partial<UmlActivityStructure>;
    if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.partitions)) {
      return null;
    }
    return this.ensureUmlLayout({
      nodes: candidate.nodes,
      edges: Array.isArray(candidate.edges) ? candidate.edges : [],
      partitions: candidate.partitions,
      metadata: {
        umlVersion: '2.5',
        diagramType: 'ActivityDiagram',
        partitionElement: 'ActivityPartition',
        ...(candidate.metadata ?? {})
      }
    });
  }

  private hasActionableUmlNodes(uml: UmlActivityStructure): boolean {
    return uml.nodes.some(node => ['ACTION', 'DECISION', 'MERGE', 'FORK', 'JOIN', 'OBJECT_NODE', 'SEND_SIGNAL', 'ACCEPT_SIGNAL'].includes(node.type));
  }

  private ensureValidUmlActivity(uml: UmlActivityStructure): UmlActivityStructure {
    const partitions = uml.partitions.length
      ? uml.partitions
      : [{ id: 'partition_negocio', name: 'Negocio', umlElement: 'ActivityPartition' }];
    const fallbackPartition = partitions[0].id;
    const nodes = [...uml.nodes];
    if (!nodes.some(node => node.type === 'INITIAL')) {
      nodes.unshift({ id: 'uml_initial', type: 'INITIAL', label: 'Inicio', partition: fallbackPartition, umlElement: 'InitialNode' });
    }
    if (!nodes.some(node => node.type === 'ACTIVITY_FINAL')) {
      nodes.push({ id: 'uml_final', type: 'ACTIVITY_FINAL', label: 'Fin', partition: fallbackPartition, umlElement: 'ActivityFinalNode' });
    }
    return this.ensureUmlLayout({
      nodes,
      edges: uml.edges,
      partitions,
      metadata: {
        umlVersion: '2.5',
        diagramType: 'ActivityDiagram',
        partitionElement: 'ActivityPartition',
        ...(uml.metadata ?? {})
      }
    });
  }

  private roleFromPartitionId(partitionId: string): string {
    const department = this.departments.find(item => this.partitionIdFromRole(item.role) === partitionId);
    if (department?.role) {
      return department.role;
    }
    return '';
  }

  private umlNodePosition(node: UmlActivityNode): { x: number; y: number } {
    const laneIndex = Math.max(0, this.umlActivityJson.partitions.findIndex(partition => partition.id === node.partition));
    return {
      x: typeof node.x === 'number' ? node.x : this.umlLaneLabelWidth + 56 + this.umlActivityJson.nodes.filter(item => item.partition === node.partition).findIndex(item => item.id === node.id) * 190,
      y: typeof node.y === 'number' ? node.y : laneIndex * this.umlLaneHeight + 54
    };
  }

  private umlNodeSize(node: UmlActivityNode): { width: number; height: number } {
    switch (node.type) {
      case 'INITIAL':
      case 'ACTIVITY_FINAL':
        return { width: 34, height: 34 };
      case 'DECISION':
      case 'MERGE':
        return { width: 76, height: 76 };
      case 'FORK':
      case 'JOIN':
        return { width: 12, height: 118 };
      case 'NOTE':
      case 'OBJECT_NODE':
        return { width: 118, height: 72 };
      default:
        return { width: 148, height: 58 };
    }
  }

  private setUmlNodePosition(nodeId: string, x: number, y: number, updatePartition = false): void {
    const node = this.umlActivityJson.nodes.find(item => item.id === nodeId);
    const size = node ? this.umlNodeSize(node) : { width: 140, height: 60 };
    const clampedX = Math.max(this.umlLaneLabelWidth + 18, Math.min(this.umlCanvasWidth - size.width - 18, x));
    const currentLaneIndex = Math.max(0, this.umlActivityJson.partitions.findIndex(partition => partition.id === node?.partition));
    const laneIndex = updatePartition
      ? Math.max(0, Math.min(this.umlActivityJson.partitions.length - 1, Math.floor((y + size.height / 2) / this.umlLaneHeight)))
      : currentLaneIndex;
    const partition = this.umlActivityJson.partitions[laneIndex]?.id;
    const laneTop = laneIndex * this.umlLaneHeight;
    const laneBottom = laneTop + this.umlLaneHeight;
    const clampedY = Math.max(laneTop + 8, Math.min(laneBottom - size.height - 8, y));
    this.umlActivityJson = {
      ...this.umlActivityJson,
      nodes: this.umlActivityJson.nodes.map(item =>
        item.id === nodeId
          ? { ...item, x: clampedX, y: clampedY, partition: updatePartition && partition ? partition : item.partition }
          : item
      )
    };
  }

  private ensureUmlLayout(uml: UmlActivityStructure): UmlActivityStructure {
    const laneCounts = new Map<string, number>();
    const nodes = uml.nodes.map(node => {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        return node;
      }
      const laneIndex = Math.max(0, uml.partitions.findIndex(partition => partition.id === node.partition));
      const count = laneCounts.get(node.partition) ?? 0;
      laneCounts.set(node.partition, count + 1);
      const size = this.umlNodeSize(node);
      return {
        ...node,
        x: this.umlLaneLabelWidth + 56 + count * 190,
        y: laneIndex * this.umlLaneHeight + Math.max(34, (this.umlLaneHeight - size.height) / 2)
      };
    });
    return {
      ...uml,
      nodes,
      metadata: {
        ...(uml.metadata ?? {}),
        umlVersion: '2.5',
        diagramType: 'ActivityDiagram',
        partitionElement: 'ActivityPartition',
        orientation: 'horizontal',
        canonical: true
      }
    };
  }

  private uniqueUmlId(prefix: string): string {
    const existing = new Set([
      ...this.umlActivityJson.nodes.map(node => node.id),
      ...this.umlActivityJson.edges.map(edge => edge.id),
      ...this.umlActivityJson.partitions.map(partition => partition.id)
    ]);
    const normalizedPrefix = prefix
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'uml_item';
    let candidate = normalizedPrefix;
    let index = 1;
    while (existing.has(candidate)) {
      candidate = `${normalizedPrefix}_${index++}`;
    }
    return candidate;
  }

  private createUmlNode(type: string, label: string, partition: string): UmlActivityNode {
    const idPrefix = type.toLowerCase();
    return {
      id: this.uniqueUmlId(`uml_${idPrefix}`),
      type,
      label,
      partition,
      umlElement: this.umlElementForNodeType(type)
    };
  }

  private insertUmlDecision(label: string, partition: string): void {
    const decision = this.createUmlNode('DECISION', label, partition);
    const yesAction = this.createUmlNode('ACTION', 'Ejecutar camino aprobado', partition);
    const noAction = this.createUmlNode('ACTION', 'Ejecutar camino rechazado', partition);
    const merge = this.createUmlNode('MERGE', 'Unir resultado', partition);
    this.insertUmlSegment(
      [decision, yesAction, noAction, merge],
      [
        { id: this.uniqueUmlId(`${decision.id}_yes`), source: decision.id, target: yesAction.id, type: 'ControlFlow', guard: '[si]' },
        { id: this.uniqueUmlId(`${decision.id}_no`), source: decision.id, target: noAction.id, type: 'ControlFlow', guard: '[no]' },
        { id: this.uniqueUmlId(`${yesAction.id}_merge`), source: yesAction.id, target: merge.id, type: 'ControlFlow' },
        { id: this.uniqueUmlId(`${noAction.id}_merge`), source: noAction.id, target: merge.id, type: 'ControlFlow' }
      ],
      decision.id,
      merge.id
    );
  }

  private insertAdditionalFinal(label: string, partition: string): void {
    const uml = this.ensureValidUmlActivity(this.umlActivityJson);
    const finalNode = this.createUmlNode('ACTIVITY_FINAL', label, partition);
    const sourceId = this.lastExecutableSourceId(uml);
    this.umlActivityJson = {
      ...uml,
      nodes: [...uml.nodes, finalNode],
      edges: [
        ...uml.edges,
        { id: this.uniqueUmlId(`${sourceId}_${finalNode.id}`), source: sourceId, target: finalNode.id, type: 'ControlFlow' }
      ]
    };
  }

  private insertUmlNote(label: string, partition: string): void {
    const uml = this.ensureValidUmlActivity(this.umlActivityJson);
    const note = this.createUmlNode('NOTE', label, partition);
    const sourceId = this.lastExecutableSourceId(uml);
    this.umlActivityJson = {
      ...uml,
      nodes: [...uml.nodes, note],
      edges: [
        ...uml.edges,
        { id: this.uniqueUmlId(`${sourceId}_${note.id}`), source: sourceId, target: note.id, type: 'Annotation' }
      ]
    };
  }

  private insertUmlSegment(nodesToInsert: UmlActivityNode[], internalEdges: UmlActivityEdge[], entryId?: string, exitId?: string): void {
    const uml = this.ensureValidUmlActivity(this.umlActivityJson);
    const finalNode = uml.nodes.find(node => node.type === 'ACTIVITY_FINAL');
    const finalId = finalNode?.id ?? 'uml_final';
    const incomingToFinal = [...uml.edges].reverse().find(edge => edge.target === finalId);
    const sourceId = incomingToFinal?.source
      ?? uml.nodes.find(node => node.type === 'INITIAL')?.id
      ?? uml.nodes[0]?.id
      ?? 'uml_initial';
    const cleanEdges = incomingToFinal
      ? uml.edges.filter(edge => edge.id !== incomingToFinal.id)
      : uml.edges;
    const firstId = entryId ?? nodesToInsert[0].id;
    const lastId = exitId ?? nodesToInsert[nodesToInsert.length - 1].id;
    const edgeType = nodesToInsert[0].type === 'OBJECT_NODE' ? 'ObjectFlow' : 'ControlFlow';

    this.umlActivityJson = {
      ...uml,
      nodes: [
        ...uml.nodes.filter(node => node.id !== finalId),
        ...nodesToInsert,
        ...uml.nodes.filter(node => node.id === finalId)
      ],
      edges: [
        ...cleanEdges,
        { id: this.uniqueUmlId(`${sourceId}_${firstId}`), source: sourceId, target: firstId, type: edgeType },
        ...internalEdges,
        { id: this.uniqueUmlId(`${lastId}_${finalId}`), source: lastId, target: finalId, type: 'ControlFlow' }
      ]
    };
  }

  private lastExecutableSourceId(uml: UmlActivityStructure): string {
    const finalIds = new Set(uml.nodes.filter(node => node.type === 'ACTIVITY_FINAL').map(node => node.id));
    const incomingToFinal = [...uml.edges].reverse().find(edge => finalIds.has(edge.target));
    return incomingToFinal?.source
      ?? uml.nodes.find(node => node.type !== 'ACTIVITY_FINAL' && node.type !== 'NOTE')?.id
      ?? uml.nodes[0]?.id
      ?? 'uml_initial';
  }

  private defaultLabelForUmlType(type: string): string {
    return {
      ACTION: 'Registrar solicitud',
      DECISION: '¿Condición cumplida?',
      MERGE: 'Unir caminos',
      FORK: 'Dividir tareas paralelas',
      JOIN: 'Sincronizar tareas',
      OBJECT_NODE: 'Documento/Formulario',
      SEND_SIGNAL: 'Enviar notificación',
      ACCEPT_SIGNAL: 'Esperar respuesta',
      NOTE: 'Nota aclaratoria',
      ACTIVITY_FINAL: 'Fin alternativo'
    }[type] ?? 'Nueva actividad';
  }

  private createEmptyUmlActivity(): UmlActivityStructure {
    return this.ensureUmlLayout({
      nodes: [
        { id: 'uml_initial', type: 'INITIAL', label: 'Inicio', partition: 'partition_negocio', umlElement: 'InitialNode' },
        { id: 'uml_final', type: 'ACTIVITY_FINAL', label: 'Fin', partition: 'partition_negocio', umlElement: 'ActivityFinalNode' }
      ],
      edges: [
        { id: 'uml_edge_empty_1', source: 'uml_initial', target: 'uml_final', type: 'ControlFlow' }
      ],
      partitions: [{ id: 'partition_negocio', name: 'Negocio', umlElement: 'ActivityPartition' }],
      metadata: {
        umlVersion: '2.5',
        diagramType: 'ActivityDiagram',
        partitionElement: 'ActivityPartition'
      }
    });
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

    const enrichedXml = this.createTechnicalBpmnXml();
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
      umlActivityJson: this.umlActivityJson,
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
      umlActivityJson: this.umlActivityJson,
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
      this.umlActivityJson = this.normalizeUmlActivity(payload.umlActivityJson) ?? this.umlActivityJson;
      this.taskBindings = this.cloneTaskBindings(payload.taskBindings ?? []);
      this.syncTasksFromUml();
      const technicalXml = this.createTechnicalBpmnXml();
      await this.importXml(technicalXml);
      this.xmlPreview = technicalXml;
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
