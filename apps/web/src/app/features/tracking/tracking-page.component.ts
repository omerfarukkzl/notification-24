import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  RowClassRules
} from 'ag-grid-community';
import { Subscription } from 'rxjs';
import {
  ConnectionState,
  LoadState,
  NotificationSummary,
  TrackingRow
} from '../../core/models/app.models';
import { NotificationsService } from '../../core/services/notifications.service';
import { PresenceService } from '../../core/services/presence.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-tracking-page',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <section class="page tracking">
      <header class="page-head">
        <div>
          <p class="eyebrow">Bildirim Takip</p>
          <h2>Teslim durumunu anlık takip et.</h2>
          <p>
            <span class="status-badge" [attr.data-state]="connectionState()">
              {{ connectionLabel() }}
            </span>
          </p>
        </div>
      </header>

      <section class="status-panel" *ngIf="notificationLoadState() === 'loading'">
        <p>Bildirim başlıkları yükleniyor...</p>
      </section>

      <section class="status-panel error" *ngIf="notificationLoadState() === 'error'">
        <p>{{ notificationLoadError() || 'Bildirim başlıkları alınamadı.' }}</p>
        <button type="button" (click)="loadNotificationSummaries()">Tekrar dene</button>
      </section>

      <section class="empty-state" *ngIf="notificationLoadState() === 'success' && notifications().length === 0">
        <h3>Takip edilecek bildirim yok</h3>
        <p>Önce kullanıcı ekranından bir bildirim gönder.</p>
      </section>

      <label class="tracking-filter" *ngIf="notifications().length > 0">
        Bildirim Başlığı
        <select [value]="selectedNotificationId()" (change)="onNotificationChange($any($event.target).value)">
          <option value="">Bildirim seç</option>
          <option *ngFor="let item of notifications()" [value]="item.id">
            {{ item.title }} · {{ item.createdAtUtc | date:'short' }}
          </option>
        </select>
      </label>

      <section class="empty-state" *ngIf="notifications().length > 0 && !selectedNotificationId()">
        <h3>Bir bildirim seç</h3>
        <p>Grid üzerinde teslim durumlarını görmek için üstteki listeden bir bildirim başlığı seç.</p>
      </section>

      <section class="status-panel" *ngIf="selectedNotificationId() && trackingLoadState() === 'loading'">
        <p>Takip verisi yükleniyor...</p>
      </section>

      <section class="status-panel error" *ngIf="selectedNotificationId() && trackingLoadState() === 'error'">
        <p>{{ trackingLoadError() || 'Takip verisi alınamadı.' }}</p>
        <button type="button" (click)="reloadSelected()">Tekrar dene</button>
      </section>

      <section class="empty-state" *ngIf="selectedNotificationId() && trackingLoadState() === 'success' && rows().length === 0">
        <h3>Kayıt bulunamadı</h3>
        <p>Seçili bildirim için teslim kaydı oluşmamış görünüyor.</p>
      </section>

      <ag-grid-angular
        *ngIf="selectedNotificationId() && trackingLoadState() === 'success' && rows().length > 0"
        class="ag-theme-quartz tracking-grid"
        [rowData]="rows()"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        [animateRows]="true"
        [rowClassRules]="rowClassRules"
        (gridReady)="onGridReady($event)"
      ></ag-grid-angular>

      <p class="legend" *ngIf="selectedNotificationId() && rows().length > 0">
        <span class="legend-chip received"></span> Alan kullanıcılar yeşil görünür.
      </p>
    </section>
  `
})
export class TrackingPageComponent implements OnInit, OnDestroy {
  private readonly subscriptions: Subscription[] = [];
  private readonly pulseUserIds = new Set<string>();
  private gridApi: GridApi<TrackingRow> | null = null;

  readonly notifications = signal<NotificationSummary[]>([]);
  readonly rows = signal<TrackingRow[]>([]);
  readonly selectedNotificationId = signal('');
  readonly connectionState = signal<ConnectionState>('disconnected');

  readonly notificationLoadState = signal<LoadState>('idle');
  readonly notificationLoadError = signal('');
  readonly trackingLoadState = signal<LoadState>('idle');
  readonly trackingLoadError = signal('');

  readonly columnDefs: ColDef<TrackingRow>[] = [
    { field: 'userName', headerName: 'Kullanıcı Adı', minWidth: 160 },
    { field: 'fullName', headerName: 'Ad Soyad', minWidth: 190 },
    {
      field: 'isOnline',
      headerName: 'Durum',
      minWidth: 130,
      valueFormatter: (params) => params.value ? 'Online' : 'Offline'
    },
    {
      headerName: 'Canlı',
      minWidth: 130,
      valueGetter: (params) => this.pulseUserIds.has(params.data?.userId ?? '') ? 'Teslim edildi' : '-',
      cellClass: (params) => this.pulseUserIds.has(params.data?.userId ?? '') ? 'delivery-mark' : undefined
    },
    { field: 'deliveryStatus', headerName: 'Teslim Durumu', minWidth: 140 },
    {
      field: 'deliveredAtUtc',
      headerName: 'Teslim Zamanı',
      minWidth: 190,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString('tr-TR') : '-'
    }
  ];

  readonly defaultColDef: ColDef<TrackingRow> = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 120
  };

  readonly rowClassRules: RowClassRules<TrackingRow> = {
    'received-row': (params) => params.data?.hasReceived === true,
    'delivery-pulse': (params) => this.pulseUserIds.has(params.data?.userId ?? '')
  };

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly presenceService: PresenceService,
    private readonly toastService: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    this.loadNotificationSummaries();

    try {
      await this.presenceService.connect();
    } catch {
      this.toastService.push({
        kind: 'error',
        title: 'Bağlantı sorunu',
        message: 'Canlı durum servisine bağlanılamadı.',
        timeoutMs: 6500
      });
    }

    this.subscriptions.push(
      this.presenceService.connectionState$.subscribe((state) => this.connectionState.set(state)),
      this.presenceService.presenceChanged$.subscribe((event) => {
        this.rows.update((items) => items.map((row) => row.userId === event.userId ? { ...row, isOnline: event.isOnline } : row));
      }),
      this.presenceService.deliveryUpdated$.subscribe((event) => {
        if (event.notificationId !== this.selectedNotificationId()) {
          return;
        }

        this.pulseUserIds.add(event.recipientUserId);
        this.rows.update((items) => items.map((row) => row.userId === event.recipientUserId
          ? {
              ...row,
              hasReceived: true,
              deliveryStatus: event.status,
              deliveredAtUtc: event.deliveredAtUtc
            }
          : row));
        this.gridApi?.refreshCells({ force: true });

        window.setTimeout(() => {
          this.pulseUserIds.delete(event.recipientUserId);
          this.gridApi?.refreshCells({ force: true });
        }, 1500);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    void this.presenceService.disconnect();
  }

  onGridReady(event: GridReadyEvent<TrackingRow>): void {
    this.gridApi = event.api;
  }

  onNotificationChange(notificationId: string): void {
    this.selectedNotificationId.set(notificationId);
    this.pulseUserIds.clear();

    if (!notificationId) {
      this.rows.set([]);
      this.trackingLoadState.set('idle');
      this.trackingLoadError.set('');
      return;
    }

    this.loadTrackingRows(notificationId);
  }

  reloadSelected(): void {
    const selected = this.selectedNotificationId();
    if (!selected) {
      return;
    }

    this.loadTrackingRows(selected);
  }

  connectionLabel(): string {
    const state = this.connectionState();
    if (state === 'connected') {
      return 'Canlı bağlantı aktif';
    }

    if (state === 'connecting') {
      return 'Canlı bağlantı kuruluyor';
    }

    if (state === 'reconnecting') {
      return 'Bağlantı yeniden kuruluyor';
    }

    return 'Canlı bağlantı kapalı';
  }

  loadNotificationSummaries(): void {
    this.notificationLoadState.set('loading');
    this.notificationLoadError.set('');

    this.notificationsService.getSummaries().subscribe({
      next: (items) => {
        this.notifications.set(items);
        this.notificationLoadState.set('success');
      },
      error: (error) => {
        const message = this.extractApiError(error, 'Bildirim başlıkları alınamadı.');
        this.notificationLoadError.set(message);
        this.notificationLoadState.set('error');
        this.toastService.push({
          kind: 'error',
          title: 'Listeleme hatası',
          message,
          timeoutMs: 6500
        });
      }
    });
  }

  private loadTrackingRows(notificationId: string): void {
    this.trackingLoadState.set('loading');
    this.trackingLoadError.set('');

    this.notificationsService.getTrackingRows(notificationId).subscribe({
      next: (items) => {
        this.rows.set(items);
        this.trackingLoadState.set('success');
      },
      error: (error) => {
        const message = this.extractApiError(error, 'Bildirim takip verisi alınamadı.');
        this.trackingLoadError.set(message);
        this.trackingLoadState.set('error');
        this.toastService.push({
          kind: 'error',
          title: 'Takip hatası',
          message,
          timeoutMs: 6500
        });
      }
    });
  }

  private extractApiError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    const payload = error.error;
    if (typeof payload === 'string' && payload.trim().length > 0) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }

    return fallback;
  }
}
