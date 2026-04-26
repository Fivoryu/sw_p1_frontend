import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DepartmentService } from '../../../services/department.service';
import { DepartmentDefinition } from '../../../shared/models/workflow.model';

@Component({
  selector: 'app-department-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Catálogo organizacional</span>
          <h2>Gestionar Departamentos</h2>
          <p>Administra áreas, roles y descripciones para las tareas humanas del workflow.</p>
        </div>
        <div class="header-metrics">
          <div class="metric-card">
            <span>Total</span>
            <strong>{{ departments.length }}</strong>
          </div>
          <div class="metric-card">
            <span>Modo</span>
            <strong>{{ editingDepartment ? 'Edición' : 'Nuevo' }}</strong>
          </div>
        </div>
      </header>

      <div class="layout">
        <section class="editor-panel">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Formulario</span>
              <h3>{{ editingDepartment ? 'Editar departamento' : 'Nuevo departamento' }}</h3>
            </div>
            <button class="ghost-btn" type="button" *ngIf="editingDepartment" (click)="resetDraft()">Limpiar</button>
          </div>

          <div class="form-grid">
            <label class="input-group">
              <span>Nombre visible</span>
              <input [(ngModel)]="draft.name" placeholder="Ej. Gerencia de Riesgos" />
            </label>

            <label class="input-group">
              <span>Rol técnico</span>
              <input [(ngModel)]="draft.role" placeholder="ROLE_RIESGO" />
            </label>

            <label class="input-group full-width">
              <span>Descripción</span>
              <textarea [(ngModel)]="draft.description" rows="5" placeholder="Describe qué tipo de tareas atiende este departamento"></textarea>
            </label>
          </div>

          <div class="actions">
            <button class="primary-btn" type="button" (click)="saveDepartment()">
              {{ editingDepartment ? 'Actualizar departamento' : 'Crear departamento' }}
            </button>
            <button class="secondary-btn" type="button" *ngIf="editingDepartment" (click)="resetDraft()">Cancelar edición</button>
          </div>

          <p class="feedback" *ngIf="feedback">{{ feedback }}</p>
        </section>

        <section class="catalog-panel">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Directorio</span>
              <h3>Catálogo actual</h3>
            </div>
          </div>

          <div class="department-list">
            <article class="department-card" *ngFor="let department of departments">
              <div class="department-main">
                <div class="department-top">
                  <h4>{{ department.name }}</h4>
                  <span class="role-chip">{{ department.role }}</span>
                </div>
                <p>{{ department.description || 'Sin descripción registrada.' }}</p>
              </div>

              <div class="card-actions">
                <button class="secondary-btn" type="button" (click)="editDepartment(department)">Editar</button>
                <button class="danger-btn" type="button" (click)="deleteDepartment(department.id)">Eliminar</button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 20px; color: #0f172a; }
    .page-header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
    .eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: #1d4ed8; }
    .page-header h2 { margin: 8px 0 6px; font-size: 32px; }
    .page-header p { margin: 0; color: #475569; max-width: 720px; }
    .header-metrics { display: flex; gap: 12px; flex-wrap: wrap; }
    .metric-card, .editor-panel, .catalog-panel { background: rgba(255,255,255,.92); border: 1px solid #dbe4f0; border-radius: 24px; box-shadow: 0 18px 40px rgba(15,23,42,.08); }
    .metric-card { min-width: 120px; padding: 14px 16px; display: grid; gap: 8px; }
    .metric-card span { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .metric-card strong { font-size: 24px; }
    .layout { display: grid; grid-template-columns: minmax(360px, 420px) minmax(0, 1fr); gap: 18px; }
    .editor-panel, .catalog-panel { padding: 22px; display: grid; gap: 18px; }
    .panel-header { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .panel-header h3 { margin: 8px 0 0; font-size: 24px; }
    .ghost-btn, .primary-btn, .secondary-btn, .danger-btn { border: 0; border-radius: 14px; padding: 11px 16px; cursor: pointer; font-weight: 700; }
    .ghost-btn { background: #eef2ff; color: #3730a3; }
    .primary-btn { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; }
    .secondary-btn { background: #e2e8f0; color: #0f172a; }
    .danger-btn { background: #fee2e2; color: #991b1b; }
    .form-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
    .input-group { display: grid; gap: 8px; }
    .input-group span { font-weight: 700; color: #334155; }
    .input-group input, .input-group textarea { width: 100%; padding: 13px 14px; border: 1px solid #cbd5e1; border-radius: 16px; background: #f8fafc; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .feedback { margin: 0; color: #0369a1; }
    .department-list { display: grid; gap: 14px; }
    .department-card { border: 1px solid #dbe4f0; border-radius: 20px; padding: 18px; background: #f8fafc; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; }
    .department-main { min-width: 0; display: grid; gap: 10px; }
    .department-top { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
    .department-top h4 { margin: 0; font-size: 21px; }
    .role-chip { display: inline-flex; padding: 6px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 700; }
    .department-main p { margin: 0; color: #475569; line-height: 1.6; }
    .card-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
      .page-header, .department-card { grid-template-columns: 1fr; }
      .department-card { display: grid; }
      .card-actions { justify-content: flex-start; }
    }
  `]
})
export class DepartmentManagementComponent implements OnInit {
  departments: DepartmentDefinition[] = [];
  editingDepartment: DepartmentDefinition | null = null;
  feedback = '';

  draft: Omit<DepartmentDefinition, 'id'> = {
    name: '',
    role: '',
    description: ''
  };

  constructor(private departmentService: DepartmentService) {}

  ngOnInit(): void {
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: departments => this.departments = departments,
      error: () => this.feedback = 'No se pudo cargar el catálogo de departamentos.'
    });
  }

  saveDepartment(): void {
    if (!this.draft.name.trim() || !this.draft.role.trim()) {
      this.feedback = 'El departamento necesita nombre y rol.';
      return;
    }

    const request$ = this.editingDepartment
      ? this.departmentService.updateDepartment(this.editingDepartment.id, { ...this.draft, active: true })
      : this.departmentService.createDepartment(this.draft);

    request$.subscribe({
      next: () => {
        this.feedback = this.editingDepartment ? 'Departamento actualizado.' : 'Departamento creado.';
        this.resetDraft();
        this.loadDepartments();
      },
      error: err => this.feedback = err.error?.message ?? 'No se pudo guardar el departamento.'
    });
  }

  editDepartment(department: DepartmentDefinition): void {
    this.editingDepartment = department;
    this.draft = {
      name: department.name,
      role: department.role,
      description: department.description ?? ''
    };
  }

  deleteDepartment(id: string): void {
    this.departmentService.deleteDepartment(id).subscribe({
      next: () => {
        this.feedback = 'Departamento eliminado.';
        this.loadDepartments();
      },
      error: err => this.feedback = err.error?.message ?? 'No se pudo eliminar el departamento.'
    });
  }

  resetDraft(): void {
    this.editingDepartment = null;
    this.draft = { name: '', role: '', description: '' };
  }
}
