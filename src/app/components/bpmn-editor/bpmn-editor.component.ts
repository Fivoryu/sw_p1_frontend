import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ToastrService } from 'ngx-toastr';
import { WorkflowService } from '../../shared/services/workflow.service';

declare var BpmnModeler: any;

@Component({
  selector: 'app-bpmn-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule
  ],
  template: `
    <div class="editor-container">
      <div class="toolbar">
        <input
          type="text"
          placeholder="Nombre de la política"
          [(ngModel)]="policyName"
          class="input-policy-name"
        />
        <input
          type="text"
          placeholder="Descripción"
          [(ngModel)]="policyDescription"
          class="input-policy-desc"
        />
        <button mat-raised-button color="primary" (click)="onSavePolicy()">
          Guardar Política
        </button>
        <button mat-raised-button (click)="onExportBPMN()">
          Exportar XML
        </button>
      </div>

      <div class="canvas" #canvas id="canvas"></div>
    </div>
  `,
  styles: [`
    .editor-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .toolbar {
      padding: 10px;
      background-color: #f5f5f5;
      border-bottom: 1px solid #ddd;
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .input-policy-name,
    .input-policy-desc {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      flex: 1;
    }

    .canvas {
      flex: 1;
      background: white;
    }
  `]
})
export class BpmnEditorComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef;

  private modeler: any;
  policyName = '';
  policyDescription = '';
  currentBpmnXml = '';

  private defaultDiagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1"/>
    <bpmn:endEvent id="EndEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="150" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BPMNShape_EndEvent_1" bpmnElement="EndEvent_1">
        <dc:Bounds x="400" y="150" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  constructor(
    private workflowService: WorkflowService,
    private toastr: ToastrService
  ) {}

  async ngAfterViewInit() {
    // Importar bpmn-js de forma dinámica (requiere load previo en index.html)
    // Por ahora, inicializamos cuando esté disponible
    this.initializeEditor();
  }

  private initializeEditor() {
    // Este código ejecuta cuando bpmn-js esté cargado
    // Por ahora es un placeholder
    this.toastr.info('Editor BPMN inicializado (necesita bpmn-js librería cargada)');
  }

  onSavePolicy() {
    if (!this.policyName) {
      this.toastr.error('Ingresa el nombre de la política');
      return;
    }

    // Aquí iría la lógica para guardar
    // this.workflowService.createPolicy(this.policyName, this.policyDescription, this.currentBpmnXml)
    this.toastr.success('Política guardada (implementación pendiente)');
  }

  onExportBPMN() {
    // Aquí exportar XML
    this.toastr.info('XML exportado (implementación pendiente)');
  }
}
