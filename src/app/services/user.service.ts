import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  departamento?: string;
  empresa?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  roles: string[];
  departamento?: string;
}

export interface UpdateUserRequest {
  email?: string;
  roles?: string[];
  departamento?: string;
  active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:8080/api/v1/users';

  constructor(private http: HttpClient) {}

  listUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(this.apiUrl);
  }

  getUser(id: string): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.apiUrl}/${id}`);
  }

  createUser(payload: CreateUserRequest): Observable<AdminUser> {
    return this.http.post<AdminUser>(this.apiUrl, payload);
  }

  updateUser(id: string, payload: UpdateUserRequest): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.apiUrl}/${id}`, payload);
  }

  deactivateUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  assignRoles(id: string, roles: string[]): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.apiUrl}/${id}/roles`, { roles });
  }

  listAvailableRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/roles/available`);
  }
}

