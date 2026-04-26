import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Components
import { LoginComponent } from './modules/auth/login/login.component';
import { LogoutComponent } from './modules/auth/logout/logout.component';
import { AdminShellLayoutComponent } from './layouts/admin-shell-layout.component';
import { OperatorShellLayoutComponent } from './layouts/operator-shell-layout.component';
import { AdminDashboardComponent } from './modules/admin/admin-dashboard/admin-dashboard.component';
import { DepartmentManagementComponent } from './modules/admin/department-management/department-management.component';
import { PolicyEditorComponent } from './modules/admin/policy-editor/policy-editor.component';
import { OperatorDashboardComponent } from './modules/operator/operator-dashboard/operator-dashboard.component';
import { ExecuteTaskComponent } from './modules/operator/execute-task/execute-task.component';
import { TaskWorklistComponent } from './modules/operator/task-worklist/task-worklist.component';
import { ProcessHistoryComponent } from './modules/operator/process-history/process-history.component';

// Guards
import { AdminGuard, AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  // Public routes
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'logout',
    component: LogoutComponent
  },

  // Admin routes
  {
    path: 'admin',
    canActivate: [AdminGuard],
    component: AdminShellLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        component: AdminDashboardComponent
      },
      {
        path: 'policies',
        component: PolicyEditorComponent
      },
      {
        path: 'workflows',
        component: PolicyEditorComponent
      },
      {
        path: 'forms',
        component: PolicyEditorComponent
      },
      {
        path: 'departments',
        component: DepartmentManagementComponent
      }
    ]
  },

  {
    path: 'operator',
    canActivate: [AuthGuard],
    data: { roles: ['ROLE_REVISOR', 'ROLE_GERENTE'] },
    component: OperatorShellLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        component: OperatorDashboardComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ROLE_REVISOR', 'ROLE_GERENTE'] }
      },
      {
        path: 'tasks',
        component: TaskWorklistComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ROLE_REVISOR', 'ROLE_GERENTE'] }
      },
      {
        path: 'tasks/:id',
        component: ExecuteTaskComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ROLE_REVISOR', 'ROLE_GERENTE'] }
      },
      {
        path: 'history',
        component: ProcessHistoryComponent,
        canActivate: [AuthGuard],
        data: { roles: ['ROLE_REVISOR', 'ROLE_GERENTE'] }
      }
    ]
  },

  // Default route
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },

  // Wildcard route
  {
    path: '**',
    redirectTo: '/login'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
