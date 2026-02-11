import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  title: string;
  message: string;
  timeoutMs: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);

  push(input: Omit<ToastMessage, 'id'>): void {
    const toast: ToastMessage = {
      id: crypto.randomUUID(),
      ...input
    };

    this.toasts.update((items) => [toast, ...items]);

    if (toast.timeoutMs > 0) {
      window.setTimeout(() => this.dismiss(toast.id), toast.timeoutMs);
    }
  }

  dismiss(id: string): void {
    this.toasts.update((items) => items.filter((item) => item.id !== id));
  }
}
