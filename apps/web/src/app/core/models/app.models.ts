export interface SessionUser {
  userId: string;
  firebaseUid: string;
  userName: string;
  fullName: string;
  email: string;
  roles: string[];
}

export type LoadState = 'idle' | 'loading' | 'success' | 'error';

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface UserRow {
  id: string;
  userName: string;
  email: string;
  fullName: string;
  createdByUserId?: string;
  isOnline: boolean;
  lastSeenAtUtc?: string;
}

export interface NotificationSummary {
  id: string;
  title: string;
  createdAtUtc: string;
}

export interface TrackingRow {
  userId: string;
  userName: string;
  fullName: string;
  isOnline: boolean;
  hasReceived: boolean;
  deliveryStatus: 'Pending' | 'Delivered' | 'Read';
  deliveredAtUtc?: string;
}

export interface InboxNotification {
  notificationId: string;
  title: string;
  body: string;
  createdAtUtc: string;
  deliveryStatus: 'Pending' | 'Delivered' | 'Read';
  deliveredAtUtc?: string;
}

export interface PresenceEvent {
  userId: string;
  isOnline: boolean;
  atUtc: string;
}

export interface NotificationReceivedEvent {
  notificationId: string;
  title: string;
  body: string;
  atUtc: string;
}

export interface DeliveryUpdatedEvent {
  notificationId: string;
  recipientUserId: string;
  status: 'Pending' | 'Delivered' | 'Read';
  deliveredAtUtc?: string;
}
