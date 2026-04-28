import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PolicyService, BusinessPolicy } from '../../../services/policy.service';

interface AdminUseCase {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in-progress';
  route?: string;
  action?: string;
}

/**
 * Dashboard del Administrador
 * Muestra un resumen de todas las funcionalidades del Ciclo 1
 */
@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  currentUser = this.authService.currentUserValue;
  policies: BusinessPolicy[] = [];
  loading = true;
  error: string | null = null;
  policySearch = '';
  policyStatusFilter = 'ALL';

  // Ciclo 1 - Casos de Uso
  usesCases: AdminUseCase[] = [
    {
      id: 'CU-04',
      name: 'Gestionar Usuarios',
      description: 'Administración del acceso por empresa y rol',
      status: 'completed',
      route: '/admin/dashboard'
    },
    {
      id: 'CU-05',
      name: 'Roles y permisos',
      description: 'Gobernanza de permisos y perfiles operativos',
      status: 'completed',
      route: '/admin/dashboard'
    },
    {
      id: 'CU-07',
      name: 'Gestionar Políticas de Negocio',
      description: 'Catálogo, versiones, borradores y publicación',
      status: 'completed',
      route: '/admin/policies'
    },
    {
      id: 'CU-08',
      name: 'Diseñar Diagrama de Actividades',
      description: 'BPMN workflow designer',
      status: 'completed',
      route: '/admin/workflows'
    },
    {
      id: 'CU-10',
      name: 'Gestionar Formularios Dinámicos',
      description: 'Form builder integrado al diseñador de políticas',
      status: 'in-progress',
      route: '/admin/policies'
    },
    {
      id: 'CU-06',
      name: 'Gestionar Departamentos',
      description: 'Catálogo global de departamentos y roles',
      status: 'completed',
      route: '/admin/departments'
    },
    {
      id: 'CU-09',
      name: 'Edición colaborativa',
      description: 'Trabajo compartido por WebSocket en políticas',
      status: 'completed',
      route: '/admin/policies'
    },
    {
      id: 'CU-11/12',
      name: 'OCR y generación por prompt',
      description: 'Carga por imagen y base BPMN asistida',
      status: 'in-progress',
      route: '/admin/policies'
    }
  ];

  constructor(
    private authService: AuthService,
    private policyService: PolicyService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPolicies();
  }

  /**
   * Carga las políticas de negocio
   */
  loadPolicies(): void {
    this.policyService.getPolicies().subscribe(
      (policies: BusinessPolicy[]) => {
        this.policies = policies;
        this.loading = false;
      },
      (error: any) => {
        this.error = 'Error al cargar las políticas';
        console.error(error);
        this.loading = false;
      }
    );
  }

  /**
   * CU2: Cierra la sesión
   */
  logout(): void {
    if (confirm('¿Desea cerrar sesión?')) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  /**
   * Navega a un caso de uso
   */
  navigateTo(route: string, queryParams?: Record<string, string>): void {
    this.router.navigate([route], queryParams ? { queryParams } : undefined);
  }

  /**
   * Ejecuta una acción del caso de uso
   */
  executeAction(action: string): void {
    if (action === 'logout') {
      this.logout();
    }
  }

  /**
   * Obtiene la clase CSS del estado
   */
  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  get publishedPoliciesCount(): number {
    return this.policies.filter(policy => policy.status === 'PUBLISHED').length;
  }

  get draftPoliciesCount(): number {
    return this.policies.filter(policy => policy.status === 'DRAFT').length;
  }

  get archivedPoliciesCount(): number {
    return this.policies.filter(policy => policy.status === 'ARCHIVED').length;
  }

  get filteredPolicies(): BusinessPolicy[] {
    const term = this.policySearch.trim().toLowerCase();
    return this.policies.filter(policy => {
      const matchesSearch = !term ||
        policy.name.toLowerCase().includes(term) ||
        (policy.description ?? '').toLowerCase().includes(term);
      const matchesStatus = this.policyStatusFilter === 'ALL' || policy.status === this.policyStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }
}
