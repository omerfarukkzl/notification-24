import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-stack',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="toast-stack" aria-live="polite" aria-label="bildirimler">
      <article
        *ngFor="let toast of toastService.toasts()"
        class="toast"
        [attr.data-kind]="toast.kind"
      >
        <header>{{ toast.title }}</header>
        <p>{{ toast.message }}</p>
        <pre class="toast-details" *ngIf="toast.details && isExpanded(toast.id)">{{ toast.details }}</pre>
        <footer class="toast-actions">
          <button
            type="button"
            class="ghost"
            *ngIf="toast.details"
            (click)="toggleExpand(toast.id)"
          >
            {{ isExpanded(toast.id) ? 'Detayı gizle' : 'Detayı göster' }}
          </button>
          <button type="button" (click)="toastService.dismiss(toast.id)">Kapat</button>
        </footer>
      </article>
    </aside>
  `
})
export class ToastStackComponent {
  private readonly expandedIds = signal<string[]>([]);

  constructor(public readonly toastService: ToastService) {}

  toggleExpand(id: string): void {
    this.expandedIds.update((items) => items.includes(id)
      ? items.filter((item) => item !== id)
      : [...items, id]);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().includes(id);
  }
}
