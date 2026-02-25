import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  RowClassRules
} from 'ag-grid-community';
import { Subscription } from 'rxjs';
import {
  ConnectionState,
  InboxNotification,
  LoadState,
  UserRow
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { PresenceService } from '../../core/services/presence.service';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users.service';

type UserField = 'userName' | 'email' | 'fullName' | 'password';
type DispatchField = 'title' | 'body' | 'targetMode';
type ConfirmMode = 'delete' | 'dispatchAll' | null;

interface ParsedApiError {
  summary: string;
  details?: string;
  fieldErrors: Record<string, string>;
}

interface DispatchPayload {
  title: string;
  body: string;
  targetMode: 'selected' | 'all';
  userIds: string[];
}

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Kullanıcı Yönetimi</p>
          <h2>Kullanıcıları yönet, bildirimleri daha hızlı gönder.</h2>
          <p>
            <span class="status-badge" [attr.data-state]="connectionState()">
              {{ connectionLabel() }}
            </span>
          </p>
        </div>

        <div class="action-row">
          <button type="button" (click)="openCreateModal()">Yeni Kullanıcı</button>
          <button
            type="button"
            [disabled]="selectedUsers().length !== 1 || deleteInProgress()"
            (click)="requestDeleteSelected()"
          >
            {{ deleteInProgress() ? 'Siliniyor...' : 'Sil' }}
          </button>
          <button
            type="button"
            [disabled]="selectedUsers().length !== 1"
            (click)="openEditModal()"
          >
            Güncelle
          </button>
          <button
            type="button"
            class="accent"
            [disabled]="dispatchInProgress()"
            (click)="openDispatchModal('selected')"
          >
            Seçililere Bildirim
          </button>
          <button
            type="button"
            [disabled]="dispatchAllTargetCount() === 0 || dispatchInProgress()"
            (click)="openDispatchModal('all')"
          >
            Tüm Kullanıcılara Bildirim
          </button>
        </div>
      </header>

      <section class="selection-bar" aria-live="polite">
        <p>
          <strong>{{ selectedUsers().length }}</strong> / {{ users().length }} seçili
        </p>
        <button
          type="button"
          class="ghost"
          [disabled]="selectedUsers().length === 0"
          (click)="clearSelection()"
        >
          Seçimi temizle
        </button>
      </section>

      <p class="action-hint" *ngIf="selectedUsers().length === 0">
        Seçililere bildirim göndermek için gridden en az bir kullanıcı seç.
      </p>

      <section class="status-panel" *ngIf="usersLoadState() === 'loading'">
        <p>Kullanıcı listesi yükleniyor...</p>
      </section>

      <section class="status-panel error" *ngIf="usersLoadState() === 'error'">
        <p>{{ usersLoadError() || 'Kullanıcı listesi alınamadı.' }}</p>
        <button type="button" (click)="loadUsers()">Tekrar dene</button>
      </section>

      <section class="empty-state" *ngIf="usersLoadState() === 'success' && users().length === 0">
        <h3>Henüz kullanıcı yok</h3>
        <p>İlk kullanıcıyı ekleyerek yönetim ve bildirim akışını başlat.</p>
        <button type="button" class="accent" (click)="openCreateModal()">İlk kullanıcıyı ekle</button>
      </section>

      <ag-grid-angular
        *ngIf="usersLoadState() === 'success' && users().length > 0"
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

        <p class="status-inline" *ngIf="inboxLoadState() === 'loading'">Bildirimler yükleniyor...</p>

        <div class="status-inline status-inline-error" *ngIf="inboxLoadState() === 'error'">
          <span>{{ inboxLoadError() || 'Gelen bildirimler alınamadı.' }}</span>
          <button type="button" class="ghost" (click)="loadInbox()">Tekrar dene</button>
        </div>

        <p class="status-inline" *ngIf="inboxLoadState() === 'success' && inbox().length === 0">
          Henüz bildirim yok.
        </p>

        <ul *ngIf="inbox().length > 0">
          <li *ngFor="let item of inbox()">
            <strong>{{ item.title }}</strong>
            <p>{{ item.body }}</p>
            <small>{{ item.deliveryStatus }} · {{ item.createdAtUtc | date:'short' }}</small>
          </li>
        </ul>
      </section>

      <dialog
        [open]="showUserModal()"
        class="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
      >
        <form
          class="modal-card"
          [attr.aria-busy]="saveInProgress()"
          [formGroup]="userForm"
          (ngSubmit)="saveUser()"
        >
          <h3 id="user-modal-title">{{ editTarget() ? 'Kullanıcı Güncelle' : 'Yeni Kullanıcı' }}</h3>

          <p class="form-alert error" *ngIf="userFormError()" role="alert">
            {{ userFormError() }}
          </p>

          <label>
            Kullanıcı Adı
            <input
              id="user-name-input"
              formControlName="userName"
              type="text"
              autocomplete="username"
              [readonly]="!!editTarget()"
              [attr.aria-invalid]="!!userControlError('userName')"
            />
            <small class="field-error" *ngIf="userControlError('userName') as error">{{ error }}</small>
          </label>

          <label>
            Email
            <input
              formControlName="email"
              type="email"
              autocomplete="email"
              [attr.aria-invalid]="!!userControlError('email')"
            />
            <small class="field-error" *ngIf="userControlError('email') as error">{{ error }}</small>
          </label>

          <label>
            Ad Soyad
            <input
              formControlName="fullName"
              type="text"
              autocomplete="name"
              [attr.aria-invalid]="!!userControlError('fullName')"
            />
            <small class="field-error" *ngIf="userControlError('fullName') as error">{{ error }}</small>
          </label>

          <label>
            {{ editTarget() ? 'Yeni Şifre (opsiyonel)' : 'Şifre' }}
            <input
              formControlName="password"
              type="password"
              autocomplete="new-password"
              [attr.aria-invalid]="!!userControlError('password')"
            />
            <small class="field-error" *ngIf="userControlError('password') as error">{{ error }}</small>
          </label>

          <footer>
            <button type="button" class="ghost" [disabled]="saveInProgress()" (click)="closeUserModal()">
              Vazgeç
            </button>
            <button type="submit" [disabled]="saveInProgress()">
              {{ saveInProgress() ? 'Kaydediliyor...' : 'Kaydet' }}
            </button>
          </footer>
        </form>
      </dialog>

      <dialog
        [open]="showDispatchModal()"
        class="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-modal-title"
      >
        <form
          class="modal-card"
          [attr.aria-busy]="dispatchInProgress()"
          [formGroup]="dispatchForm"
          (ngSubmit)="sendNotification()"
        >
          <h3 id="dispatch-modal-title">Bildirim Gönder</h3>

          <p class="form-alert error" *ngIf="dispatchFormError()" role="alert">
            {{ dispatchFormError() }}
          </p>

          <label>
            Başlık
            <input
              id="dispatch-title-input"
              formControlName="title"
              type="text"
              [attr.aria-invalid]="!!dispatchControlError('title')"
            />
            <small class="field-error" *ngIf="dispatchControlError('title') as error">{{ error }}</small>
          </label>

          <label>
            İçerik
            <textarea
              formControlName="body"
              rows="4"
              [attr.aria-invalid]="!!dispatchControlError('body')"
            ></textarea>
            <small class="field-error" *ngIf="dispatchControlError('body') as error">{{ error }}</small>
          </label>

          <label>
            Hedef
            <select formControlName="targetMode" [attr.aria-invalid]="!!dispatchControlError('targetMode')">
              <option value="selected">Seçili Kullanıcılar</option>
              <option value="all">Tüm Kullanıcılar</option>
            </select>
            <small class="field-error" *ngIf="dispatchControlError('targetMode') as error">{{ error }}</small>
          </label>

          <footer>
            <button type="button" class="ghost" [disabled]="dispatchInProgress()" (click)="closeDispatchModal()">
              Vazgeç
            </button>
            <button type="submit" [disabled]="dispatchInProgress()">
              {{ dispatchInProgress() ? 'Gönderiliyor...' : 'Gönder' }}
            </button>
          </footer>
        </form>
      </dialog>

      <dialog
        [open]="showConfirmModal()"
        class="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <form class="modal-card confirm-card" [attr.aria-busy]="confirmInProgress()" (ngSubmit)="confirmAction()">
          <h3 id="confirm-modal-title">{{ confirmTitle() }}</h3>
          <p>{{ confirmMessage() }}</p>

          <footer>
            <button
              id="confirm-cancel-button"
              type="button"
              class="ghost"
              [disabled]="confirmInProgress()"
              (click)="cancelConfirm()"
            >
              Vazgeç
            </button>
            <button type="submit" class="danger" [disabled]="confirmInProgress()">
              {{ confirmInProgress() ? 'İşleniyor...' : confirmApproveLabel() }}
            </button>
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
  private lastFocusedElement: HTMLElement | null = null;

  readonly rowSelection: GridOptions<UserRow>['rowSelection'] = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true
  };

  readonly users = signal<UserRow[]>([]);
  readonly inbox = signal<InboxNotification[]>([]);
  readonly selectedUsers = signal<UserRow[]>([]);
  readonly usersLoadState = signal<LoadState>('idle');
  readonly usersLoadError = signal('');
  readonly inboxLoadState = signal<LoadState>('idle');
  readonly inboxLoadError = signal('');
  readonly connectionState = signal<ConnectionState>('disconnected');

  readonly showUserModal = signal(false);
  readonly showDispatchModal = signal(false);
  readonly showConfirmModal = signal(false);
  readonly confirmMode = signal<ConfirmMode>(null);
  readonly editTarget = signal<UserRow | null>(null);
  readonly pendingDeleteUser = signal<UserRow | null>(null);
  readonly pendingDispatchPayload = signal<DispatchPayload | null>(null);

  readonly saveInProgress = signal(false);
  readonly dispatchInProgress = signal(false);
  readonly deleteInProgress = signal(false);
  readonly confirmInProgress = signal(false);

  readonly userFormError = signal('');
  readonly dispatchFormError = signal('');
  readonly userFieldErrors = signal<Partial<Record<UserField, string>>>({});
  readonly dispatchFieldErrors = signal<Partial<Record<DispatchField, string>>>({});

  readonly currentUserId = computed(() => this.authService.currentSession()?.userId ?? '');
  readonly dispatchAllTargetCount = computed(() => {
    const currentUserId = this.currentUserId();
    return this.users().filter((user) => user.id !== currentUserId).length;
  });

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
      headerName: 'Canlı Durum',
      minWidth: 150,
      valueGetter: (params) => this.deliveryPulseUserIds.has(params.data?.id ?? '') ? 'Teslim edildi' : '-',
      cellClass: (params) => this.deliveryPulseUserIds.has(params.data?.id ?? '') ? 'delivery-mark' : undefined
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
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly dispatchForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    body: ['', [Validators.required, Validators.minLength(3)]],
    targetMode: ['selected' as 'selected' | 'all', [Validators.required]]
  });

  readonly getRowId = (params: { data: UserRow }) => params.data.id;

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly presenceService: PresenceService,
    private readonly toastService: ToastService
  ) {}

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (this.showConfirmModal()) {
      event.preventDefault();
      this.cancelConfirm();
      return;
    }

    if (this.showDispatchModal()) {
      event.preventDefault();
      this.closeDispatchModal();
      return;
    }

    if (this.showUserModal()) {
      event.preventDefault();
      this.closeUserModal();
    }
  }

  async ngOnInit(): Promise<void> {
    this.loadUsers();
    this.loadInbox();

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
        }, 1600);
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

  clearSelection(): void {
    this.gridApi?.deselectAll();
    this.selectedUsers.set([]);
  }

  openCreateModal(): void {
    this.rememberFocusOrigin();
    this.editTarget.set(null);
    this.resetUserErrors();
    this.userForm.reset({ userName: '', email: '', fullName: '', password: '' });
    this.setPasswordRequired(true);
    this.showUserModal.set(true);
    this.focusById('user-name-input');
  }

  openEditModal(): void {
    const user = this.selectedUsers()[0];
    if (!user) {
      return;
    }

    this.rememberFocusOrigin();
    this.editTarget.set(user);
    this.resetUserErrors();
    this.userForm.reset({
      userName: user.userName,
      email: user.email,
      fullName: user.fullName,
      password: ''
    });
    this.setPasswordRequired(false);
    this.showUserModal.set(true);
    this.focusById('user-name-input');
  }

  closeUserModal(): void {
    this.showUserModal.set(false);
    this.resetUserErrors();
    this.restoreFocusIfNoModalOpen();
  }

  saveUser(): void {
    if (this.saveInProgress()) {
      return;
    }

    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.resetUserErrors();
    this.saveInProgress.set(true);

    const payload = this.userForm.getRawValue();
    const editing = this.editTarget();

    if (editing) {
      this.usersService.update(editing.id, {
        email: payload.email.trim(),
        fullName: payload.fullName.trim(),
        password: payload.password.trim().length > 0 ? payload.password : undefined
      }).subscribe({
        next: () => {
          this.toastService.push({
            kind: 'success',
            title: 'Kullanıcı güncellendi',
            message: payload.fullName,
            timeoutMs: 2200
          });
          this.saveInProgress.set(false);
          this.closeUserModal();
          this.loadUsers();
        },
        error: (error) => {
          const parsed = this.parseApiError(error, 'Kullanıcı güncellenemedi.');
          this.userFormError.set(parsed.summary);
          this.userFieldErrors.set(this.pickUserFieldErrors(parsed.fieldErrors));
          this.toastService.push({
            kind: 'error',
            title: 'Kullanıcı güncellenemedi',
            message: parsed.summary,
            details: parsed.details,
            timeoutMs: 7000
          });
          this.saveInProgress.set(false);
        }
      });

      return;
    }

    this.usersService.create({
      userName: payload.userName.trim(),
      email: payload.email.trim(),
      fullName: payload.fullName.trim(),
      password: payload.password
    }).subscribe({
      next: () => {
        this.toastService.push({
          kind: 'success',
          title: 'Kullanıcı eklendi',
          message: payload.fullName,
          timeoutMs: 2200
        });
        this.saveInProgress.set(false);
        this.closeUserModal();
        this.loadUsers();
      },
      error: (error) => {
        const parsed = this.parseApiError(error, 'Kullanıcı oluşturulamadı.');
        this.userFormError.set(parsed.summary);
        this.userFieldErrors.set(this.pickUserFieldErrors(parsed.fieldErrors));
        this.toastService.push({
          kind: 'error',
          title: 'Kullanıcı oluşturulamadı',
          message: parsed.summary,
          details: parsed.details,
          timeoutMs: 7000
        });
        this.saveInProgress.set(false);
      }
    });
  }

  requestDeleteSelected(): void {
    const user = this.selectedUsers()[0];
    if (!user || this.deleteInProgress()) {
      return;
    }

    this.rememberFocusOrigin();
    this.pendingDeleteUser.set(user);
    this.confirmMode.set('delete');
    this.showConfirmModal.set(true);
    this.focusById('confirm-cancel-button');
  }

  openDispatchModal(targetMode: 'selected' | 'all'): void {
    if (targetMode === 'all' && this.dispatchAllTargetCount() === 0) {
      this.toastService.push({
        kind: 'info',
        title: 'Hedef kullanıcı yok',
        message: 'Tüm kullanıcılara bildirim için hedef kullanıcı bulunamadı.',
        timeoutMs: 4200
      });
      return;
    }

    this.rememberFocusOrigin();
    this.resetDispatchErrors();
    this.dispatchForm.reset({ title: '', body: '', targetMode });
    this.showDispatchModal.set(true);
    this.focusById('dispatch-title-input');
  }

  closeDispatchModal(restoreFocus = true, clearPending = true): void {
    this.showDispatchModal.set(false);
    this.resetDispatchErrors();
    if (clearPending) {
      this.pendingDispatchPayload.set(null);
    }

    if (restoreFocus) {
      this.restoreFocusIfNoModalOpen();
    }
  }

  sendNotification(): void {
    if (this.dispatchInProgress()) {
      return;
    }

    if (this.dispatchForm.invalid) {
      this.dispatchForm.markAllAsTouched();
      return;
    }

    this.resetDispatchErrors();

    const payload = this.dispatchForm.getRawValue();
    const selectedIds = this.selectedUsers().map((user) => user.id);

    if (payload.targetMode === 'selected' && selectedIds.length === 0) {
      this.dispatchFormError.set('Seçili kullanıcı modu için en az bir kullanıcı seçmelisin.');
      this.dispatchFieldErrors.set({ targetMode: 'Hedef olarak seçili kullanıcılar için en az bir satır seç.' });
      return;
    }

    const dispatchPayload: DispatchPayload = {
      title: payload.title.trim(),
      body: payload.body.trim(),
      targetMode: payload.targetMode,
      userIds: payload.targetMode === 'selected' ? selectedIds : []
    };

    if (dispatchPayload.targetMode === 'all') {
      this.pendingDispatchPayload.set(dispatchPayload);
      this.closeDispatchModal(false, false);
      this.confirmMode.set('dispatchAll');
      this.showConfirmModal.set(true);
      this.focusById('confirm-cancel-button');
      return;
    }

    this.executeDispatch(dispatchPayload);
  }

  confirmAction(): void {
    if (this.confirmInProgress()) {
      return;
    }

    const mode = this.confirmMode();
    if (mode === 'delete') {
      const user = this.pendingDeleteUser();
      if (!user) {
        this.cancelConfirm();
        return;
      }

      this.confirmInProgress.set(true);
      this.deleteInProgress.set(true);

      this.usersService.remove(user.id).subscribe({
        next: () => {
          this.toastService.push({
            kind: 'success',
            title: 'Kullanıcı silindi',
            message: user.fullName,
            timeoutMs: 2200
          });
          this.confirmInProgress.set(false);
          this.deleteInProgress.set(false);
          this.pendingDeleteUser.set(null);
          this.finishConfirm();
          this.loadUsers();
        },
        error: (error) => {
          const parsed = this.parseApiError(error, 'Kullanıcı silinemedi.');
          this.toastService.push({
            kind: 'error',
            title: 'Kullanıcı silinemedi',
            message: parsed.summary,
            details: parsed.details,
            timeoutMs: 7000
          });
          this.confirmInProgress.set(false);
          this.deleteInProgress.set(false);
        }
      });
      return;
    }

    if (mode === 'dispatchAll') {
      const payload = this.pendingDispatchPayload();
      if (!payload) {
        this.cancelConfirm();
        return;
      }

      this.confirmInProgress.set(true);
      this.executeDispatch(payload, true);
    }
  }

  cancelConfirm(): void {
    const mode = this.confirmMode();
    this.showConfirmModal.set(false);
    this.confirmMode.set(null);
    this.confirmInProgress.set(false);
    this.pendingDeleteUser.set(null);

    if (mode === 'dispatchAll' && this.pendingDispatchPayload()) {
      this.showDispatchModal.set(true);
      this.focusById('dispatch-title-input');
      return;
    }

    this.pendingDispatchPayload.set(null);
    this.restoreFocusIfNoModalOpen();
  }

  confirmTitle(): string {
    const mode = this.confirmMode();
    if (mode === 'delete') {
      return 'Kullanıcıyı sil';
    }

    if (mode === 'dispatchAll') {
      return 'Toplu bildirim onayı';
    }

    return '';
  }

  confirmMessage(): string {
    const mode = this.confirmMode();
    if (mode === 'delete') {
      const userName = this.pendingDeleteUser()?.fullName ?? 'Seçili kullanıcı';
      return `${userName} kullanıcısını kalıcı olarak silmek üzeresin. Bu işlem geri alınamaz.`;
    }

    if (mode === 'dispatchAll') {
      return `${this.dispatchAllTargetCount()} kullanıcıya bildirim gönderilecek. Devam etmek istiyor musun?`;
    }

    return '';
  }

  confirmApproveLabel(): string {
    return this.confirmMode() === 'delete' ? 'Sil' : 'Gönder';
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

  userControlError(field: UserField): string | null {
    const apiError = this.userFieldErrors()[field];
    if (apiError) {
      return apiError;
    }

    const control = this.userForm.controls[field];
    if (!control.touched || !control.invalid) {
      return null;
    }

    if (control.hasError('required')) {
      if (field === 'password') {
        return 'Şifre zorunludur.';
      }

      return 'Bu alan zorunludur.';
    }

    if (control.hasError('email')) {
      return 'Geçerli bir email gir.';
    }

    if (control.hasError('minlength')) {
      if (field === 'password') {
        return 'Şifre en az 6 karakter olmalıdır.';
      }

      return 'Bu alan çok kısa.';
    }

    return null;
  }

  dispatchControlError(field: DispatchField): string | null {
    const apiError = this.dispatchFieldErrors()[field];
    if (apiError) {
      return apiError;
    }

    const control = this.dispatchForm.controls[field];
    if (!control.touched || !control.invalid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Bu alan zorunludur.';
    }

    if (control.hasError('minlength')) {
      return 'Bu alan çok kısa.';
    }

    return null;
  }

  loadUsers(): void {
    this.usersLoadState.set('loading');
    this.usersLoadError.set('');

    this.usersService.getAll().subscribe({
      next: (rows) => {
        this.users.set(rows);
        this.usersLoadState.set('success');
        this.clearSelection();
      },
      error: (error) => {
        const parsed = this.parseApiError(error, 'Kullanıcı listesi alınamadı.');
        this.usersLoadError.set(parsed.summary);
        this.usersLoadState.set('error');
        this.toastService.push({
          kind: 'error',
          title: 'Listeleme hatası',
          message: parsed.summary,
          details: parsed.details,
          timeoutMs: 7000
        });
      }
    });
  }

  loadInbox(): void {
    this.inboxLoadState.set('loading');
    this.inboxLoadError.set('');

    this.notificationsService.getInbox().subscribe({
      next: (items) => {
        this.inbox.set(items.slice(0, 8));
        this.inboxLoadState.set('success');
      },
      error: (error) => {
        const parsed = this.parseApiError(error, 'Gelen bildirimler alınamadı.');
        this.inboxLoadError.set(parsed.summary);
        this.inboxLoadState.set('error');
        this.toastService.push({
          kind: 'error',
          title: 'Inbox hatası',
          message: parsed.summary,
          details: parsed.details,
          timeoutMs: 7000
        });
      }
    });
  }

  private executeDispatch(payload: DispatchPayload, fromConfirmModal = false): void {
    this.dispatchInProgress.set(true);
    this.notificationsService.dispatch(payload).subscribe({
      next: (result) => {
        this.toastService.push({
          kind: 'success',
          title: 'Bildirim kuyruğa alındı',
          message: `${result.recipientCount} kullanıcı hedeflendi.`,
          timeoutMs: 3200
        });

        this.dispatchInProgress.set(false);
        if (fromConfirmModal) {
          this.pendingDispatchPayload.set(null);
          this.finishConfirm();
          return;
        }

        this.closeDispatchModal();
      },
      error: (error) => {
        const parsed = this.parseApiError(error, 'Bildirim gönderilemedi.');
        this.dispatchInProgress.set(false);
        this.confirmInProgress.set(false);

        if (fromConfirmModal) {
          this.cancelConfirm();
          this.dispatchFormError.set(parsed.summary);
          this.dispatchFieldErrors.set(this.pickDispatchFieldErrors(parsed.fieldErrors));
        } else {
          this.dispatchFormError.set(parsed.summary);
          this.dispatchFieldErrors.set(this.pickDispatchFieldErrors(parsed.fieldErrors));
        }

        this.toastService.push({
          kind: 'error',
          title: 'Gönderim hatası',
          message: parsed.summary,
          details: parsed.details,
          timeoutMs: 7000
        });
      }
    });
  }

  private setPasswordRequired(required: boolean): void {
    const validators = required
      ? [Validators.required, Validators.minLength(6)]
      : [Validators.minLength(6)];
    this.userForm.controls.password.setValidators(validators);
    this.userForm.controls.password.updateValueAndValidity();
  }

  private resetUserErrors(): void {
    this.userFormError.set('');
    this.userFieldErrors.set({});
  }

  private resetDispatchErrors(): void {
    this.dispatchFormError.set('');
    this.dispatchFieldErrors.set({});
  }

  private finishConfirm(): void {
    this.showConfirmModal.set(false);
    this.confirmMode.set(null);
    this.confirmInProgress.set(false);
    this.pendingDeleteUser.set(null);
    this.pendingDispatchPayload.set(null);
    this.restoreFocusIfNoModalOpen();
  }

  private rememberFocusOrigin(): void {
    if (this.lastFocusedElement) {
      return;
    }

    const active = document.activeElement;
    this.lastFocusedElement = active instanceof HTMLElement ? active : null;
  }

  private restoreFocusIfNoModalOpen(): void {
    if (this.showUserModal() || this.showDispatchModal() || this.showConfirmModal()) {
      return;
    }

    if (this.lastFocusedElement) {
      this.lastFocusedElement.focus();
      this.lastFocusedElement = null;
    }
  }

  private focusById(id: string): void {
    window.setTimeout(() => {
      const element = document.getElementById(id);
      if (element instanceof HTMLElement) {
        element.focus();
      }
    }, 0);
  }

  private pickUserFieldErrors(fieldErrors: Record<string, string>): Partial<Record<UserField, string>> {
    const result: Partial<Record<UserField, string>> = {};

    for (const [key, value] of Object.entries(fieldErrors)) {
      const mapped = this.mapFieldKey(key);
      if (mapped === 'userName' || mapped === 'email' || mapped === 'fullName' || mapped === 'password') {
        result[mapped] = value;
      }
    }

    return result;
  }

  private pickDispatchFieldErrors(fieldErrors: Record<string, string>): Partial<Record<DispatchField, string>> {
    const result: Partial<Record<DispatchField, string>> = {};

    for (const [key, value] of Object.entries(fieldErrors)) {
      const mapped = this.mapFieldKey(key);
      if (mapped === 'title' || mapped === 'body' || mapped === 'targetMode') {
        result[mapped] = value;
      }
    }

    return result;
  }

  private parseApiError(error: unknown, fallback: string): ParsedApiError {
    if (!(error instanceof HttpErrorResponse)) {
      return { summary: fallback, fieldErrors: {} };
    }

    const payload = error.error;
    const fieldErrors: Record<string, string> = {};
    let summary = fallback;
    let details: string | undefined;

    if (typeof payload === 'string' && payload.trim().length > 0) {
      summary = payload.trim();
      const mappedField = this.mapFieldKey(summary);
      if (mappedField) {
        fieldErrors[mappedField] = summary;
      }
      return { summary, details, fieldErrors };
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
        summary = parts.join(' | ');
      }

      return { summary, details, fieldErrors };
    }

    if (payload && typeof payload === 'object') {
      const candidate = payload as {
        message?: unknown;
        detail?: unknown;
        title?: unknown;
        errors?: unknown;
      };

      if (typeof candidate.message === 'string' && candidate.message.trim().length > 0) {
        summary = candidate.message;
      } else if (typeof candidate.title === 'string' && candidate.title.trim().length > 0) {
        summary = candidate.title;
      }

      if (typeof candidate.detail === 'string' && candidate.detail.trim().length > 0) {
        details = candidate.detail;
      }

      if (candidate.errors && typeof candidate.errors === 'object') {
        for (const [key, value] of Object.entries(candidate.errors as Record<string, unknown>)) {
          if (Array.isArray(value)) {
            const message = value
              .map((item) => typeof item === 'string' ? item.trim() : '')
              .filter((item) => item.length > 0)
              .join(' ');
            if (message.length > 0) {
              fieldErrors[key] = message;
            }
          }
        }

        if (Object.keys(fieldErrors).length > 0 && summary === fallback) {
          summary = Object.values(fieldErrors)[0];
        }
      }
    }

    return { summary, details, fieldErrors };
  }

  private mapFieldKey(raw: string): string | null {
    const value = raw.toLowerCase();

    if (value.includes('username') || value.includes('kullan')) {
      return 'userName';
    }

    if (value.includes('email')) {
      return 'email';
    }

    if (value.includes('fullname') || value.includes('ad soyad') || value.includes('full name')) {
      return 'fullName';
    }

    if (value.includes('password') || value.includes('şifre') || value.includes('sifre')) {
      return 'password';
    }

    if (value.includes('title') || value.includes('başlık') || value.includes('baslik')) {
      return 'title';
    }

    if (value.includes('body') || value.includes('içerik') || value.includes('icerik')) {
      return 'body';
    }

    if (value.includes('target')) {
      return 'targetMode';
    }

    return null;
  }
}
