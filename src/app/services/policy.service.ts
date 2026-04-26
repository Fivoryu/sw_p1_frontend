import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DepartmentDefinition, FormDefinition, Policy } from '../shared/models/workflow.model';

/**
 * CU3: Gestionar Políticas de Negocio
 * Interfaz para políticas de negocio
 */
export type BusinessPolicy = Policy;

export interface CreatePolicyRequest {
  name: string;
  description: string;
  bpmnXml: string;
  departments: DepartmentDefinition[];
  forms: FormDefinition[];
  collaborationEnabled?: boolean;
  collaborationMode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PolicyService {
  private apiUrl = 'http://localhost:8080/api/v1/policies';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todas las políticas
   */
  getPolicies(): Observable<BusinessPolicy[]> {
    return this.http.get<BusinessPolicy[]>(this.apiUrl);
  }

  /**
   * Obtiene una política específica
   */
  getPolicy(id: string): Observable<BusinessPolicy> {
    return this.http.get<BusinessPolicy>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea una nueva política
   */
  createPolicy(policy: CreatePolicyRequest): Observable<BusinessPolicy> {
    return this.http.post<BusinessPolicy>(this.apiUrl, policy);
  }

  /**
   * Actualiza una política
   */
  updatePolicy(id: string, policy: Partial<BusinessPolicy>): Observable<BusinessPolicy> {
    return this.http.put<BusinessPolicy>(`${this.apiUrl}/${id}`, {
      name: policy.name,
      description: policy.description,
      bpmnXml: policy.bpmnXml,
      departments: policy.departments ?? [],
      forms: policy.forms ?? [],
      collaborationEnabled: policy.collaborationEnabled ?? false,
      collaborationMode: policy.collaborationMode ?? 'PRIVATE'
    });
  }

  /**
   * Publica una política
   */
  publishPolicy(id: string): Observable<BusinessPolicy> {
    return this.http.post<BusinessPolicy>(`${this.apiUrl}/${id}/publish`, {});
  }

  /**
   * Archiva una política
   */
  archivePolicy(id: string): Observable<BusinessPolicy> {
    return this.http.post<BusinessPolicy>(`${this.apiUrl}/${id}/archive`, {});
  }

  /**
   * Elimina una política
   */
  deletePolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
