import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';
import { InboxNotification, NotificationSummary, TrackingRow } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/api/notifications`;

  constructor(private readonly http: HttpClient) {}

  dispatch(payload: { title: string; body: string; targetMode: 'selected' | 'all'; userIds: string[] }): Observable<{ notificationId: string; recipientCount: number }> {
    return this.http.post<{ notificationId: string; recipientCount: number }>(`${this.baseUrl}/dispatch`, payload);
  }

  getSummaries(): Observable<NotificationSummary[]> {
    return this.http.get<NotificationSummary[]>(this.baseUrl);
  }

  getTrackingRows(notificationId: string): Observable<TrackingRow[]> {
    return this.http.get<TrackingRow[]>(`${this.baseUrl}/tracking/${notificationId}`);
  }

  getInbox(): Observable<InboxNotification[]> {
    return this.http.get<InboxNotification[]>(`${this.baseUrl}/inbox`);
  }

  acknowledge(notificationId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/acknowledge/${notificationId}`, {});
  }
}
