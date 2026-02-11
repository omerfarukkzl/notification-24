import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../config/environment';
import { AuthService } from './auth.service';
import { DeliveryUpdatedEvent, NotificationReceivedEvent, PresenceEvent } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private connection: HubConnection | null = null;

  readonly presenceChanged$ = new Subject<PresenceEvent>();
  readonly notificationReceived$ = new Subject<NotificationReceivedEvent>();
  readonly deliveryUpdated$ = new Subject<DeliveryUpdatedEvent>();

  constructor(private readonly authService: AuthService) {}

  async connect(): Promise<void> {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      return;
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/hubs/presence`, {
        accessTokenFactory: async () => (await this.authService.getIdToken()) ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.on('PresenceChanged', (payload: PresenceEvent) => this.presenceChanged$.next(payload));
    this.connection.on('NotificationReceived', (payload: NotificationReceivedEvent) => this.notificationReceived$.next(payload));
    this.connection.on('NotificationDeliveryUpdated', (payload: DeliveryUpdatedEvent) => this.deliveryUpdated$.next(payload));

    await this.connection.start();
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      return;
    }

    await this.connection.stop();
    this.connection = null;
  }
}
