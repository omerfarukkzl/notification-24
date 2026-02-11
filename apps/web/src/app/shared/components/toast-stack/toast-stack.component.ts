import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
        <button type="button" (click)="toastService.dismiss(toast.id)">Kapat</button>
      </article>
    </aside>
  `
})
export class ToastStackComponent {
  constructor(public readonly toastService: ToastService) {}
}
