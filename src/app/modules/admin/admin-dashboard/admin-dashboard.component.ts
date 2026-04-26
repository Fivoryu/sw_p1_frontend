import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PolicyService, BusinessPolicy } from '../../../services/policy.service';

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

  // Ciclo 1 - Casos de Uso
  usesCases = [
    {
      id: 'CU1',
      name: 'Iniciar Sesión',
      description: 'Autenticación del administrador',
      status: 'completed',
      route: '/admin/dashboard'
    },
    {
      id: 'CU2',
      name: 'Cerrar Sesión',
      description: 'Logout del usuario',
      status: 'completed',
      action: 'logout'
    },
    {
      id: 'CU3',
      name: 'Gestionar Políticas de Negocio',
      description: 'CRUD de políticas',
      status: 'completed',
      route: '/admin/policies'
    },
    {
      id: 'CU4',
      name: 'Diseñar Diagrama de Actividades',
      description: 'BPMN workflow designer',
      status: 'completed',
      route: '/admin/workflows'
    },
    {
      id: 'CU6',
      name: 'Gestionar Formularios Dinámicos',
      description: 'Form builder integrado al diseñador de políticas',
      status: 'in-progress',
      route: '/admin/policies'
    },
    {
      id: 'CU7',
      name: 'Gestionar Departamentos',
      description: 'Catálogo global de departamentos y roles',
      status: 'completed',
      route: '/admin/departments'
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
  navigateTo(route: string): void {
    this.router.navigate([route]);
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
}
