import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormDefinition } from '../../../shared/models/workflow.model';

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="dynamic-form" *ngIf="form">
      <div class="form-header">
        <h3>{{ form.name }}</h3>
        <p>{{ form.description }}</p>
      </div>

      <div class="form-grid">
        <div *ngFor="let field of form.fields" class="field-card">
          <label [for]="field.id">{{ field.label }} <span *ngIf="field.required">*</span></label>

          <input
            *ngIf="field.type === 'text' || field.type === 'number' || field.type === 'date'"
            [id]="field.id"
            [type]="field.type"
            [disabled]="readonly"
            [(ngModel)]="value[field.name]"
            (ngModelChange)="emitValue()"
          />

          <textarea
            *ngIf="field.type === 'textarea'"
            [id]="field.id"
            [disabled]="readonly"
            rows="4"
            [(ngModel)]="value[field.name]"
            (ngModelChange)="emitValue()"
          ></textarea>

          <select
            *ngIf="field.type === 'select'"
            [id]="field.id"
            [disabled]="readonly"
            [(ngModel)]="value[field.name]"
            (ngModelChange)="emitValue()"
          >
            <option value="">Selecciona una opción</option>
            <option *ngFor="let option of field.options ?? []" [value]="option.value">
              {{ option.label }}
            </option>
          </select>

          <label *ngIf="field.type === 'checkbox'" class="checkbox-field">
            <input
              type="checkbox"
              [disabled]="readonly"
              [(ngModel)]="value[field.name]"
              (ngModelChange)="emitValue()"
            />
            {{ field.label }}
          </label>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .dynamic-form { display: grid; gap: 18px; }
    .form-header h3 { margin: 0 0 6px; font-size: 24px; }
    .form-header p { margin: 0; color: #64748b; }
    .form-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .field-card { display: grid; gap: 8px; padding: 16px; border: 1px solid #dbe4f0; border-radius: 18px; background: #fff; }
    label { font-weight: 600; color: #0f172a; }
    input, select, textarea { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid #cbd5e1; background: #f8fafc; }
    .checkbox-field { display: flex; gap: 10px; align-items: center; }
    .checkbox-field input { width: auto; }
  `]
})
export class DynamicFormComponent {
  @Input() form: FormDefinition | null = null;
  @Input() value: Record<string, unknown> = {};
  @Input() readonly = false;
  @Output() valueChange = new EventEmitter<Record<string, unknown>>();

  emitValue(): void {
    this.valueChange.emit({ ...this.value });
  }
}
