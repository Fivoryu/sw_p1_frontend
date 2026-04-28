import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { runtimeConfig } from '../shared/config/runtime-config';

/**
 * CU4: Diseñar Diagrama de Actividades
 * Interfaz para diagramas de actividades (workflows)
 */
export interface WorkflowDiagram {
  id: string;
  name: string;
  description: string;
  bpmnXml: string;
  policyId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface CreateWorkflowRequest {
  name: string;
  description: string;
  policyId: string;
  bpmnXml: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private apiUrl = runtimeConfig.apiV1BaseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todos los diagramas de workflow
   */
  getWorkflows(): Observable<WorkflowDiagram[]> {
    return this.http.get<WorkflowDiagram[]>(`${this.apiUrl}/policies`);
  }

  /**
   * Obtiene un workflow específico
   */
  getWorkflow(id: string): Observable<WorkflowDiagram> {
    return this.http.get<WorkflowDiagram>(`${this.apiUrl}/policies/${id}`);
  }

  /**
   * Obtiene workflows de una política
   */
  getWorkflowsByPolicy(policyId: string): Observable<WorkflowDiagram[]> {
    return this.http.get<WorkflowDiagram[]>(`${this.apiUrl}/policies`);
  }

  /**
   * Crea un nuevo diagrama de actividades
   */
  createWorkflow(workflow: CreateWorkflowRequest): Observable<WorkflowDiagram> {
    return this.http.post<WorkflowDiagram>(`${this.apiUrl}/policies`, workflow as any);
  }

  /**
   * Actualiza un diagrama de actividades
   */
  updateWorkflow(id: string, workflow: Partial<WorkflowDiagram>): Observable<WorkflowDiagram> {
    return this.http.put<WorkflowDiagram>(`${this.apiUrl}/policies/${id}`, workflow as any);
  }

  /**
   * Valida el diagrama BPMN
   */
  validateWorkflow(bpmnXml: string): Observable<{ valid: boolean; errors?: string[] }> {
    return this.http.post<{ valid: boolean; errors?: string[] }>(`${this.apiUrl}/policies`, {
      name: 'validation-draft',
      description: 'validation-draft',
      bpmnXml
    });
  }

  /**
   * Publica un diagrama
   */
  publishWorkflow(id: string): Observable<WorkflowDiagram> {
    return this.http.post<WorkflowDiagram>(`${this.apiUrl}/policies/${id}/publish`, {});
  }

  /**
   * Archiva un diagrama
   */
  archiveWorkflow(id: string): Observable<WorkflowDiagram> {
    return this.http.post<WorkflowDiagram>(`${this.apiUrl}/policies/${id}/archive`, {});
  }

  /**
   * Elimina un diagrama
   */
  deleteWorkflow(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/policies/${id}`);
  }
}
