import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * CU6: Gestionar Formularios Dinámicos
 * Interfaz para formularios dinámicos
 */
export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'checkbox' | 'radio' | 'select' | 'textarea';
  required: boolean;
  validation?: any;
  options?: Array<{ label: string; value: any }>;
  order: number;
}

export interface DynamicForm {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  policyId: string;
  workflowId?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface CreateFormRequest {
  name: string;
  description: string;
  policyId: string;
  fields: FormField[];
}

@Injectable({
  providedIn: 'root'
})
export class FormBuilderService {
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todos los formularios
   */
  getForms(): Observable<DynamicForm[]> {
    return this.http.get<DynamicForm[]>(`${this.apiUrl}/forms`);
  }

  /**
   * Obtiene un formulario específico
   */
  getForm(id: string): Observable<DynamicForm> {
    return this.http.get<DynamicForm>(`${this.apiUrl}/forms/${id}`);
  }

  /**
   * Obtiene formularios de una política
   */
  getFormsByPolicy(policyId: string): Observable<DynamicForm[]> {
    return this.http.get<DynamicForm[]>(`${this.apiUrl}/policies/${policyId}/forms`);
  }

  /**
   * Crea un nuevo formulario dinámico
   */
  createForm(form: CreateFormRequest): Observable<DynamicForm> {
    return this.http.post<DynamicForm>(`${this.apiUrl}/forms`, form);
  }

  /**
   * Actualiza un formulario
   */
  updateForm(id: string, form: Partial<DynamicForm>): Observable<DynamicForm> {
    return this.http.put<DynamicForm>(`${this.apiUrl}/forms/${id}`, form);
  }

  /**
   * Agrega un campo al formulario
   */
  addField(formId: string, field: FormField): Observable<DynamicForm> {
    return this.http.post<DynamicForm>(`${this.apiUrl}/forms/${formId}/fields`, field);
  }

  /**
   * Actualiza un campo del formulario
   */
  updateField(formId: string, fieldId: string, field: Partial<FormField>): Observable<DynamicForm> {
    return this.http.put<DynamicForm>(`${this.apiUrl}/forms/${formId}/fields/${fieldId}`, field);
  }

  /**
   * Elimina un campo del formulario
   */
  deleteField(formId: string, fieldId: string): Observable<DynamicForm> {
    return this.http.delete<DynamicForm>(`${this.apiUrl}/forms/${formId}/fields/${fieldId}`);
  }

  /**
   * Publica un formulario
   */
  publishForm(id: string): Observable<DynamicForm> {
    return this.http.post<DynamicForm>(`${this.apiUrl}/forms/${id}/publish`, {});
  }

  /**
   * Archiva un formulario
   */
  archiveForm(id: string): Observable<DynamicForm> {
    return this.http.post<DynamicForm>(`${this.apiUrl}/forms/${id}/archive`, {});
  }

  /**
   * Elimina un formulario
   */
  deleteForm(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/forms/${id}`);
  }
}
