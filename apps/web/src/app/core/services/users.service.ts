import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';
import { UserRow } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly baseUrl = `${environment.apiBaseUrl}/api/users`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<UserRow[]> {
    return this.http.get<UserRow[]>(this.baseUrl);
  }

  create(payload: { userName: string; email: string; fullName: string; password: string }): Observable<UserRow> {
    return this.http.post<UserRow>(this.baseUrl, payload);
  }

  update(id: string, payload: { email: string; fullName: string; password?: string }): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
