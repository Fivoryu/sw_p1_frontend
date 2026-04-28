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
    <section class="editor-container">
      <header class="editor-header">
        <div>
          <span class="eyebrow">Diseñador BPMN</span>
          <h3>Editor base de políticas</h3>
          <p>Plantilla de edición rápida para pruebas visuales del modelador.</p>
        </div>
        <span class="status-chip">{{ statusMessage }}</span>
      </header>

      <div class="toolbar">
        <div class="inputs-grid">
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
        </div>
        <div class="toolbar-actions">
          <button mat-raised-button color="primary" (click)="onSavePolicy()">
            Guardar política
          </button>
          <button mat-raised-button (click)="onExportBPMN()">
            Exportar XML
          </button>
        </div>
      </div>

      <div class="canvas" #canvas id="canvas"></div>
    </section>
  `,
  styles: [`
    .editor-container {
      display: grid;
      gap: 12px;
      height: 100%;
    }

    .editor-header {
      border: 1px solid #dbe4f0;
      border-radius: 16px;
      padding: 14px 16px;
      background: #f8fbff;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 11px;
      font-weight: 700;
      color: #1d4ed8;
    }

    .editor-header h3 {
      margin: 8px 0 6px;
    }

    .editor-header p {
      margin: 0;
      color: #475569;
    }

    .status-chip {
      border-radius: 999px;
      background: #dbeafe;
      color: #1d4ed8;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .toolbar {
      border: 1px solid #dbe4f0;
      border-radius: 16px;
      background: #fff;
      padding: 12px;
      display: grid;
      gap: 10px;
    }

    .inputs-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .toolbar-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .input-policy-name,
    .input-policy-desc {
      padding: 10px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #f8fafc;
    }

    .canvas {
      flex: 1;
      background: white;
      min-height: 420px;
      border: 1px solid #dbe4f0;
      border-radius: 16px;
    }

    @media (max-width: 860px) {
      .editor-header {
        flex-direction: column;
      }

      .inputs-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class BpmnEditorComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef;

  private modeler: any;
  policyName = '';
  policyDescription = '';
  currentBpmnXml = '';
  statusMessage = 'Modo preparación';

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
    this.statusMessage = 'Editor inicializado';
  }

  onSavePolicy() {
    if (!this.policyName) {
      this.toastr.error('Ingresa el nombre de la política');
      return;
    }

    // Aquí iría la lógica para guardar
    // this.workflowService.createPolicy(this.policyName, this.policyDescription, this.currentBpmnXml)
    this.toastr.success('Política guardada (implementación pendiente)');
    this.statusMessage = 'Guardado local';
  }

  onExportBPMN() {
    // Aquí exportar XML
    this.toastr.info('XML exportado (implementación pendiente)');
    this.statusMessage = 'XML exportado';
  }
}
