import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../config/environment';
import { AuthService } from './auth.service';
import { ConnectionState, DeliveryUpdatedEvent, NotificationReceivedEvent, PresenceEvent } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private connection: HubConnection | null = null;
  private readonly connectionStateSubject = new BehaviorSubject<ConnectionState>('disconnected');

  readonly presenceChanged$ = new Subject<PresenceEvent>();
  readonly notificationReceived$ = new Subject<NotificationReceivedEvent>();
  readonly deliveryUpdated$ = new Subject<DeliveryUpdatedEvent>();
  readonly connectionState$ = this.connectionStateSubject.asObservable();

  constructor(private readonly authService: AuthService) {}

  async connect(): Promise<void> {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      this.connectionStateSubject.next(this.mapConnectionState(this.connection.state));
      return;
    }

    this.connectionStateSubject.next('connecting');

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

    this.connection.onreconnecting(() => {
      this.connectionStateSubject.next('reconnecting');
      return Promise.resolve();
    });
    this.connection.onreconnected(() => {
      this.connectionStateSubject.next('connected');
      return Promise.resolve();
    });
    this.connection.onclose(() => {
      this.connectionStateSubject.next('disconnected');
      return Promise.resolve();
    });

    try {
      await this.connection.start();
      this.connectionStateSubject.next('connected');
    } catch (error) {
      this.connectionStateSubject.next('disconnected');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      this.connectionStateSubject.next('disconnected');
      return;
    }

    await this.connection.stop();
    this.connection = null;
    this.connectionStateSubject.next('disconnected');
  }

  private mapConnectionState(state: HubConnectionState): ConnectionState {
    if (state === HubConnectionState.Connected) {
      return 'connected';
    }

    if (state === HubConnectionState.Connecting) {
      return 'connecting';
    }

    if (state === HubConnectionState.Reconnecting) {
      return 'reconnecting';
    }

    return 'disconnected';
  }
}
