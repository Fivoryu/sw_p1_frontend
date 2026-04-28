export interface DepartmentDefinition {
  id: string;
  name: string;
  role: string;
  description?: string;
}

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldDefinition {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: FormFieldOption[];
}

export interface FormDefinition {
  id: string;
  name: string;
  description?: string;
  fields: FormFieldDefinition[];
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  version: number;
  status: string;
  bpmnXml?: string;
  departments?: DepartmentDefinition[];
  forms?: FormDefinition[];
  ownerUserId?: string;
  tenantEmpresa?: string;
  collaborationEnabled?: boolean;
  collaborationMode?: 'PRIVATE' | 'READ_ONLY' | 'EDIT_SHARED' | string;
  lastEditedByUserId?: string;
  lastAutoSavedAt?: Date | string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessInstance {
  id: string;
  policyId: string;
  policyName: string;
  policyVersion: number;
  temporalProcessInstanceId: string;
  status: string;
  variables: { [key: string]: any };
  activeNodeIds?: string[];
  initiatedAt: Date;
  completedAt?: Date;
  history: HistoryEntry[];
  completedForms?: CompletedForm[];
}

export interface HistoryEntry {
  id?: string;
  processInstanceId?: string;
  nodeId?: string;
  nodeType?: string;
  nodeName?: string;
  taskId: string;
  taskName: string;
  assignedRole: string;
  completedByUserId: string;
  timestamp: Date;
  status: string;
  taskData: { [key: string]: any };
  taskResult?: { [key: string]: any };
  errorMessage?: string;
}

export interface CompletedForm {
  formId: string;
  taskId: string;
  nodeId: string;
  completedByUserId: string;
  completedAt: Date;
  values: { [key: string]: any };
}

export interface Task {
  id: string;
  processInstanceId: string;
  nodeId: string;
  nodeName: string;
  nodeType?: string;
  assignee: string | null;
  candidateRole?: string;
  departmentAssigned?: string;
  formId?: string;
  status: string;
  priority?: string;
  createdAt: Date;
  dueDate?: Date;
  formData?: { [key: string]: any };
  requiredDocuments?: string[];
  customerName?: string;
  customerDni?: string;
}

export interface OperatorTask {
  id: string;
  workflowInstanceId: string;
  nodoId: string;
  nombreTarea: string;
  departamentoAsignado: string;
  usuarioAsignado?: string | null;
  estado: string;
  fechaCreacion: Date;
  fechaVencimiento?: Date;
  prioridad?: string;
  formularioId?: string;
  clienteNombre?: string;
  clienteDni?: string;
}

export interface TaskDetail {
  tarea: OperatorTask;
  tramite: ProcessInstance;
  formulario?: FormDefinition | null;
  workflowGraph: { [key: string]: any };
  datosActuales: { [key: string]: any };
  borradorActual?: { [key: string]: any };
  formulariosPrevios?: {
    formularioId: string;
    tareaId: string;
    nodoId: string;
    usuarioId: string;
    fecha: Date;
    estado: string;
    valores: { [key: string]: any };
  }[];
  documentos?: {
    id: string;
    taskId?: string;
    nombreArchivo: string;
    mimeType?: string;
    estado?: string;
    fecha?: Date;
  }[];
  activeNodeIds?: string[];
  canClaim?: boolean;
  canEdit?: boolean;
  claimedByCurrentUser?: boolean;
  blockedByOtherUser?: boolean;
  accessState?: string;
}

export interface TaskCompletionResult {
  success: boolean;
  message: string;
  estadoInstancia: string;
  nuevasTareas: OperatorTask[];
  activeNodeIds: string[];
  contextoDatos: { [key: string]: any };
}

export interface ProcessHistoryDetail {
  instanciaId: string;
  policyName: string;
  estado: string;
  historialNodos: HistoryEntry[];
  formulariosCompletados: {
    formularioId: string;
    tareaId: string;
    nodoId: string;
    usuarioId: string;
    fecha: Date;
    estado: string;
    valores: { [key: string]: any };
  }[];
  documentos?: {
    id: string;
    taskId?: string;
    nombreArchivo: string;
    mimeType?: string;
    estado?: string;
    fecha?: Date;
  }[];
}

export interface DraftSaveResult {
  success: boolean;
  message: string;
  detalle: TaskDetail;
}

export interface CorrectionResult {
  success: boolean;
  message: string;
  instanciaId: string;
  nodoDevueltoId: string;
  nodoDevueltoNombre: string;
}

export interface CorrectionTarget {
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
}

export interface ProcessSearchResult {
  instanciaId: string;
  policyName: string;
  estado: string;
  clienteNombre?: string;
  clienteDni?: string;
  departamentoActual?: string;
  fechaInicio?: Date;
  ultimaActualizacion?: Date;
}
