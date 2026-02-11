import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, RowClassRules } from 'ag-grid-community';
import { Subscription } from 'rxjs';
import { NotificationSummary, TrackingRow } from '../../core/models/app.models';
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
          <h2>Seçilen bildirimin teslim durumunu anlık izle.</h2>
        </div>
      </header>

      <label class="tracking-filter">
        Bildirim Başlığı
        <select [value]="selectedNotificationId()" (change)="onNotificationChange($any($event.target).value)">
          <option value="">Bildirim seç</option>
          <option *ngFor="let item of notifications()" [value]="item.id">
            {{ item.title }} · {{ item.createdAtUtc | date:'short' }}
          </option>
        </select>
      </label>

      <ag-grid-angular
        class="ag-theme-quartz tracking-grid"
        [rowData]="rows()"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        [animateRows]="true"
        [rowClassRules]="rowClassRules"
      ></ag-grid-angular>

      <p class="legend">
        <span class="legend-chip received"></span> Alan kullanıcılar yeşil görünür.
      </p>
    </section>
  `
})
export class TrackingPageComponent implements OnInit, OnDestroy {
  private readonly subscriptions: Subscription[] = [];
  private readonly pulseUserIds = new Set<string>();

  readonly notifications = signal<NotificationSummary[]>([]);
  readonly rows = signal<TrackingRow[]>([]);
  readonly selectedNotificationId = signal('');

  readonly columnDefs: ColDef<TrackingRow>[] = [
    { field: 'userName', headerName: 'Kullanıcı Adı', minWidth: 160 },
    { field: 'fullName', headerName: 'Ad Soyad', minWidth: 190 },
    {
      field: 'isOnline',
      headerName: 'Durum',
      minWidth: 130,
      valueFormatter: (params) => params.value ? 'Online' : 'Offline'
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

    await this.presenceService.connect();

    this.subscriptions.push(
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

        window.setTimeout(() => this.pulseUserIds.delete(event.recipientUserId), 1200);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    void this.presenceService.disconnect();
  }

  onNotificationChange(notificationId: string): void {
    this.selectedNotificationId.set(notificationId);
    if (!notificationId) {
      this.rows.set([]);
      return;
    }

    this.loadTrackingRows(notificationId);
  }

  private loadNotificationSummaries(): void {
    this.notificationsService.getSummaries().subscribe({
      next: (items) => this.notifications.set(items),
      error: () => {
        this.toastService.push({ kind: 'error', title: 'Listeleme hatası', message: 'Bildirim başlıkları alınamadı.', timeoutMs: 3500 });
      }
    });
  }

  private loadTrackingRows(notificationId: string): void {
    this.notificationsService.getTrackingRows(notificationId).subscribe({
      next: (items) => this.rows.set(items),
      error: () => {
        this.toastService.push({ kind: 'error', title: 'Takip hatası', message: 'Bildirim takip verisi alınamadı.', timeoutMs: 3500 });
      }
    });
  }
}
