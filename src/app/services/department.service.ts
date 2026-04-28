import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DepartmentDefinition } from '../shared/models/workflow.model';
import { runtimeConfig } from '../shared/config/runtime-config';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private apiUrl = `${runtimeConfig.apiV1BaseUrl}/departments`;

  constructor(private http: HttpClient) {}

  getDepartments(): Observable<DepartmentDefinition[]> {
    return this.http.get<DepartmentDefinition[]>(this.apiUrl);
  }

  createDepartment(payload: Omit<DepartmentDefinition, 'id'>): Observable<DepartmentDefinition> {
    return this.http.post<DepartmentDefinition>(this.apiUrl, payload);
  }

  updateDepartment(id: string, payload: Partial<DepartmentDefinition> & { active?: boolean }): Observable<DepartmentDefinition> {
    return this.http.put<DepartmentDefinition>(`${this.apiUrl}/${id}`, payload);
  }

  deleteDepartment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
