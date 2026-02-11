import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions, GridReadyEvent, RowClassRules } from 'ag-grid-community';
import { Subscription } from 'rxjs';
import { InboxNotification, UserRow } from '../../core/models/app.models';
import { NotificationsService } from '../../core/services/notifications.service';
import { PresenceService } from '../../core/services/presence.service';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Kullanıcı Yönetimi</p>
          <h2>Aktiflik, CRUD ve bildirim dağıtımı tek panelde.</h2>
        </div>
        <div class="action-row">
          <button type="button" (click)="openCreateModal()">Yeni Kullanıcı</button>
          <button type="button" [disabled]="selectedUsers().length !== 1" (click)="openEditModal()">Güncelle</button>
          <button type="button" class="danger" [disabled]="selectedUsers().length !== 1" (click)="deleteSelected()">Sil</button>
          <button type="button" class="accent" [disabled]="selectedUsers().length === 0" (click)="openDispatchModal('selected')">Seçililere Bildirim</button>
          <button type="button" (click)="openDispatchModal('all')">Tüm Kullanıcılara Bildirim</button>
        </div>
      </header>

      <ag-grid-angular
        class="ag-theme-quartz users-grid"
        [rowData]="users()"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        [rowSelection]="rowSelection"
        [animateRows]="true"
        [getRowId]="getRowId"
        [rowClassRules]="rowClassRules"
        (gridReady)="onGridReady($event)"
        (selectionChanged)="onSelectionChanged()"
      ></ag-grid-angular>

      <section class="inbox-panel">
        <h3>Gelen Bildirimlerim</h3>
        <ul>
          <li *ngFor="let item of inbox()">
            <strong>{{ item.title }}</strong>
            <p>{{ item.body }}</p>
            <small>{{ item.deliveryStatus }} · {{ item.createdAtUtc | date:'short' }}</small>
          </li>
        </ul>
      </section>

      <dialog [open]="showUserModal()" class="modal-shell">
        <form [formGroup]="userForm" (ngSubmit)="saveUser()" class="modal-card">
          <h3>{{ editTarget() ? 'Kullanıcı Güncelle' : 'Yeni Kullanıcı' }}</h3>

          <label>
            Kullanıcı Adı
            <input formControlName="userName" type="text" autocomplete="username" [readonly]="!!editTarget()" />
          </label>

          <label>
            Email
            <input formControlName="email" type="email" autocomplete="email" />
          </label>

          <label>
            Ad Soyad
            <input formControlName="fullName" type="text" autocomplete="name" />
          </label>

          <label>
            {{ editTarget() ? 'Yeni Şifre (opsiyonel)' : 'Şifre' }}
            <input formControlName="password" type="password" autocomplete="new-password" />
          </label>

          <footer>
            <button type="button" class="ghost" (click)="closeUserModal()">Vazgeç</button>
            <button type="submit" [disabled]="userForm.invalid">Kaydet</button>
          </footer>
        </form>
      </dialog>

      <dialog [open]="showDispatchModal()" class="modal-shell">
        <form [formGroup]="dispatchForm" (ngSubmit)="sendNotification()" class="modal-card">
          <h3>Bildirim Gönder</h3>

          <label>
            Başlık
            <input formControlName="title" type="text" />
          </label>

          <label>
            İçerik
            <textarea formControlName="body" rows="4"></textarea>
          </label>

          <label>
            Hedef
            <select formControlName="targetMode">
              <option value="selected">Seçili Kullanıcılar</option>
              <option value="all">Tüm Kullanıcılar</option>
            </select>
          </label>

          <footer>
            <button type="button" class="ghost" (click)="closeDispatchModal()">Vazgeç</button>
            <button type="submit" [disabled]="dispatchForm.invalid">Gönder</button>
          </footer>
        </form>
      </dialog>
    </section>
  `
})
export class UsersPageComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private gridApi: GridApi<UserRow> | null = null;
  private readonly subscriptions: Subscription[] = [];
  private readonly deliveryPulseUserIds = new Set<string>();

  // AG Grid v32+ uses object-based rowSelection config.
  readonly rowSelection: GridOptions<UserRow>['rowSelection'] = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true
  };

  readonly users = signal<UserRow[]>([]);
  readonly inbox = signal<InboxNotification[]>([]);
  readonly selectedUsers = signal<UserRow[]>([]);
  readonly showUserModal = signal(false);
  readonly showDispatchModal = signal(false);
  readonly editTarget = signal<UserRow | null>(null);

  readonly columnDefs: ColDef<UserRow>[] = [
    { field: 'userName', headerName: 'Kullanıcı Adı', minWidth: 170 },
    { field: 'fullName', headerName: 'Ad Soyad', minWidth: 180 },
    { field: 'email', headerName: 'Email', minWidth: 240 },
    {
      field: 'isOnline',
      headerName: 'Durum',
      minWidth: 130,
      valueFormatter: (params) => params.value ? 'Online' : 'Offline'
    },
    {
      field: 'lastSeenAtUtc',
      headerName: 'Son Görülme',
      minWidth: 180,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString('tr-TR') : '-'
    }
  ];

  readonly defaultColDef: ColDef<UserRow> = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 120
  };

  readonly rowClassRules: RowClassRules<UserRow> = {
    'is-online': (params) => params.data?.isOnline === true,
    'delivery-pulse': (params) => this.deliveryPulseUserIds.has(params.data?.id ?? '')
  };

  readonly userForm = this.fb.nonNullable.group({
    userName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    password: ['', [Validators.minLength(6)]]
  });

  readonly dispatchForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    body: ['', [Validators.required, Validators.minLength(3)]],
    targetMode: ['selected' as 'selected' | 'all', [Validators.required]]
  });

  readonly getRowId = (params: { data: UserRow }) => params.data.id;

  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly presenceService: PresenceService,
    private readonly toastService: ToastService
  ) {}

  async ngOnInit(): Promise<void> {
    this.loadUsers();
    this.loadInbox();

    await this.presenceService.connect();

    this.subscriptions.push(
      this.presenceService.presenceChanged$.subscribe((event) => {
        this.users.update((rows) => rows.map((row) => row.id === event.userId
          ? { ...row, isOnline: event.isOnline, lastSeenAtUtc: event.atUtc }
          : row));
      }),
      this.presenceService.notificationReceived$.subscribe((event) => {
        this.toastService.push({
          kind: 'info',
          title: event.title,
          message: event.body,
          timeoutMs: 5000
        });
        this.loadInbox();
      }),
      this.presenceService.deliveryUpdated$.subscribe((event) => {
        this.deliveryPulseUserIds.add(event.recipientUserId);
        this.gridApi?.refreshCells({ force: true });
        window.setTimeout(() => {
          this.deliveryPulseUserIds.delete(event.recipientUserId);
          this.gridApi?.refreshCells({ force: true });
        }, 1400);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    void this.presenceService.disconnect();
  }

  onGridReady(event: GridReadyEvent<UserRow>): void {
    this.gridApi = event.api;
  }

  onSelectionChanged(): void {
    this.selectedUsers.set(this.gridApi?.getSelectedRows() ?? []);
  }

  openCreateModal(): void {
    this.editTarget.set(null);
    this.userForm.reset({ userName: '', email: '', fullName: '', password: '' });
    this.showUserModal.set(true);
  }

  openEditModal(): void {
    const user = this.selectedUsers()[0];
    if (!user) {
      return;
    }

    this.editTarget.set(user);
    this.userForm.reset({
      userName: user.userName,
      email: user.email,
      fullName: user.fullName,
      password: ''
    });
    this.showUserModal.set(true);
  }

  closeUserModal(): void {
    this.showUserModal.set(false);
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const payload = this.userForm.getRawValue();
    const editing = this.editTarget();

    if (editing) {
      this.usersService.update(editing.id, {
        email: payload.email,
        fullName: payload.fullName,
        password: payload.password || undefined
      }).subscribe({
        next: () => {
          this.toastService.push({ kind: 'success', title: 'Kullanıcı güncellendi', message: payload.fullName, timeoutMs: 2400 });
          this.closeUserModal();
          this.loadUsers();
        },
        error: (error) => {
          this.toastService.push({
            kind: 'error',
            title: 'Hata',
            message: this.extractApiError(error, 'Kullanıcı güncellenemedi.'),
            timeoutMs: 5200
          });
        }
      });

      return;
    }

    if (!payload.password) {
      this.toastService.push({ kind: 'error', title: 'Eksik bilgi', message: 'Yeni kullanıcı için şifre gerekli.', timeoutMs: 3500 });
      return;
    }

    this.usersService.create({
      userName: payload.userName,
      email: payload.email,
      fullName: payload.fullName,
      password: payload.password
    }).subscribe({
      next: () => {
        this.toastService.push({ kind: 'success', title: 'Kullanıcı eklendi', message: payload.fullName, timeoutMs: 2400 });
        this.closeUserModal();
        this.loadUsers();
      },
      error: (error) => {
        this.toastService.push({
          kind: 'error',
          title: 'Hata',
          message: this.extractApiError(error, 'Kullanıcı oluşturulamadı.'),
          timeoutMs: 5600
        });
      }
    });
  }

  deleteSelected(): void {
    const user = this.selectedUsers()[0];
    if (!user) {
      return;
    }

    if (!window.confirm(`${user.fullName} kullanıcısı silinsin mi?`)) {
      return;
    }

    this.usersService.remove(user.id).subscribe({
      next: () => {
        this.toastService.push({ kind: 'success', title: 'Kullanıcı silindi', message: user.fullName, timeoutMs: 2200 });
        this.loadUsers();
      },
      error: (error) => {
        this.toastService.push({
          kind: 'error',
          title: 'Hata',
          message: this.extractApiError(error, 'Kullanıcı silinemedi.'),
          timeoutMs: 5200
        });
      }
    });
  }

  openDispatchModal(target: 'selected' | 'all'): void {
    this.dispatchForm.reset({ title: '', body: '', targetMode: target });
    this.showDispatchModal.set(true);
  }

  closeDispatchModal(): void {
    this.showDispatchModal.set(false);
  }

  sendNotification(): void {
    if (this.dispatchForm.invalid) {
      this.dispatchForm.markAllAsTouched();
      return;
    }

    const payload = this.dispatchForm.getRawValue();
    const selectedIds = this.selectedUsers().map((user) => user.id);

    if (payload.targetMode === 'selected' && selectedIds.length === 0) {
      this.toastService.push({ kind: 'error', title: 'Seçim gerekli', message: 'En az bir kullanıcı seçin.', timeoutMs: 3500 });
      return;
    }

    this.notificationsService.dispatch({
      title: payload.title,
      body: payload.body,
      targetMode: payload.targetMode,
      userIds: payload.targetMode === 'selected' ? selectedIds : []
    }).subscribe({
      next: (result) => {
        this.toastService.push({
          kind: 'success',
          title: 'Bildirim kuyruğa alındı',
          message: `${result.recipientCount} kullanıcı hedeflendi.`,
          timeoutMs: 3200
        });
        this.closeDispatchModal();
      },
      error: () => {
        this.toastService.push({ kind: 'error', title: 'Gönderim hatası', message: 'Bildirim gönderilemedi.', timeoutMs: 3800 });
      }
    });
  }

  private loadUsers(): void {
    this.usersService.getAll().subscribe({
      next: (rows) => this.users.set(rows),
      error: () => {
        this.toastService.push({ kind: 'error', title: 'Listeleme hatası', message: 'Kullanıcı listesi alınamadı.', timeoutMs: 3500 });
      }
    });
  }

  private loadInbox(): void {
    this.notificationsService.getInbox().subscribe({
      next: (items) => this.inbox.set(items.slice(0, 8)),
      error: () => {
        this.toastService.push({ kind: 'error', title: 'Inbox hatası', message: 'Gelen bildirimler alınamadı.', timeoutMs: 3200 });
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

    if (Array.isArray(payload)) {
      const parts = payload
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          if (item && typeof item === 'object') {
            const description = (item as { description?: unknown }).description;
            if (typeof description === 'string' && description.trim().length > 0) {
              return description;
            }
          }

          return null;
        })
        .filter((item): item is string => item !== null);

      if (parts.length > 0) {
        return parts.join(' | ');
      }
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
