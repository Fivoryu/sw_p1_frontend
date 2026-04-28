import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { runtimeConfig } from '../shared/config/runtime-config';

export interface BottleneckRequest {
  workflow: {
    id: string;
    nodes: Array<Record<string, unknown>>;
    flows?: Array<Record<string, unknown>>;
    [k: string]: unknown;
  };
  tasks: Array<Record<string, unknown>>;
  sla_hours: number;
}

export interface OcrDocumentResponse {
  success: boolean;
  document_type: string;
  extracted_data: { [key: string]: any };
  raw_text: string;
  confidence: number;
  warnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowAiService {
  private apiUrl = `${runtimeConfig.apiV1BaseUrl}/ai`;

  constructor(private http: HttpClient) {}

  analyzeBottleneck(payload: BottleneckRequest): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.apiUrl}/simulation/bottleneck`, payload);
  }

  extractDocument(textHint: string, fileName?: string | null, mimeType?: string | null): Observable<OcrDocumentResponse> {
    return this.http.post<OcrDocumentResponse>(`${this.apiUrl}/ocr/document`, {
      text_hint: textHint,
      file_name: fileName || null,
      mime_type: mimeType || null
    });
  }
}

