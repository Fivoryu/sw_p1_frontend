import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { runtimeConfig } from '../config/runtime-config';
import {
  CorrectionResult,
  CorrectionTarget,
  DraftSaveResult,
  OperatorTask,
  Policy,
  ProcessSearchResult,
  ProcessHistoryDetail,
  ProcessInstance,
  Task,
  TaskCompletionResult,
  TaskDetail
} from '../models/workflow.model';

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private baseUrl = runtimeConfig.apiV1BaseUrl;

  constructor(private http: HttpClient) {}

  // Policy APIs
  createPolicy(name: string, description: string, bpmnXml: string): Observable<Policy> {
    return this.http.post<Policy>(`${this.baseUrl}/policies`, {
      name,
      description,
      bpmnXml
    });
  }

  listPolicies(): Observable<Policy[]> {
    return this.http.get<Policy[]>(`${this.baseUrl}/policies`);
  }

  getPolicy(id: string): Observable<Policy> {
    return this.http.get<Policy>(`${this.baseUrl}/policies/${id}`);
  }

  updatePolicy(id: string, bpmnXml: string): Observable<Policy> {
    return this.http.put<Policy>(`${this.baseUrl}/policies/${id}`, {
      bpmnXml
    });
  }

  deletePolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/policies/${id}`);
  }

  // Process APIs
  startProcess(policyId: string, variables: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/processes`, {
      policyId,
      variables
    });
  }

  getProcessStatus(id: string): Observable<ProcessInstance> {
    return this.http.get<ProcessInstance>(`${this.baseUrl}/processes/${id}`);
  }

  getProcessHistory(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/processes/${id}/history`);
  }

  getMyProcesses(): Observable<ProcessInstance[]> {
    return this.http.get<ProcessInstance[]>(`${this.baseUrl}/processes/my`);
  }

  // Task APIs
  completeTask(instanceId: string, taskId: string, variables: any): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/tasks/${instanceId}/${taskId}/complete`,
      { variables }
    );
  }

  getMyTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/tasks/my`);
  }

  getTask(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/tasks/${id}`);
  }

  publishPolicy(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/policies/${id}/publish`, {});
  }

  archivePolicy(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/policies/${id}/archive`, {});
  }

  // Funcionario APIs
  getOperatorInbox(): Observable<OperatorTask[]> {
    return this.http.get<OperatorTask[]>(`${this.baseUrl}/workflow/funcionario/bandeja`);
  }

  claimOperatorTask(taskId: string): Observable<TaskDetail> {
    return this.http.post<TaskDetail>(`${this.baseUrl}/workflow/funcionario/tareas/${taskId}/reclamar`, {});
  }

  getOperatorTaskDetail(taskId: string): Observable<TaskDetail> {
    return this.http.get<TaskDetail>(`${this.baseUrl}/workflow/funcionario/tareas/${taskId}`);
  }

  saveOperatorTaskDraft(taskId: string, valoresFormulario: Record<string, unknown>): Observable<DraftSaveResult> {
    return this.http.post<DraftSaveResult>(`${this.baseUrl}/workflow/funcionario/tareas/${taskId}/borrador`, {
      valoresFormulario
    });
  }

  requestOperatorTaskCorrection(taskId: string, motivo: string): Observable<CorrectionResult> {
    return this.http.post<CorrectionResult>(`${this.baseUrl}/workflow/funcionario/tareas/${taskId}/solicitar-correccion`, {
      motivo
    });
  }

  listOperatorCorrectionTargets(taskId: string): Observable<CorrectionTarget[]> {
    return this.http.get<CorrectionTarget[]>(`${this.baseUrl}/workflow/funcionario/tareas/${taskId}/correccion/targets`);
  }

  requestOperatorTaskCorrectionTo(taskId: string, motivo: string, targetNodeId?: string | null): Observable<CorrectionResult> {
    return this.http.post<CorrectionResult>(`${this.baseUrl}/workflow/funcionario/tareas/${taskId}/solicitar-correccion`, {
      motivo,
      targetNodeId: targetNodeId || null
    });
  }

  completeOperatorTask(taskId: string, valoresFormulario: Record<string, unknown>): Observable<TaskCompletionResult> {
    return this.http.post<TaskCompletionResult>(`${this.baseUrl}/workflow/funcionario/tareas/${taskId}/completar`, {
      valoresFormulario
    });
  }

  getOperatorProcessHistory(instanciaId: string): Observable<ProcessHistoryDetail> {
    return this.http.get<ProcessHistoryDetail>(`${this.baseUrl}/workflow/funcionario/tramites/${instanciaId}/historial`);
  }

  searchOperatorProcesses(filters: {
    workflowInstanceId?: string;
    clienteDni?: string;
    estado?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Observable<ProcessSearchResult[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    const query = params.toString();
    return this.http.get<ProcessSearchResult[]>(`${this.baseUrl}/workflow/funcionario/tramites/buscar${query ? `?${query}` : ''}`);
  }
}
