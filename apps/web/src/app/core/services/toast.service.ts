import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  title: string;
  message: string;
  timeoutMs: number;
  details?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly dedupeWindowMs = 2000;
  private readonly dedupeCache = new Map<string, number>();

  readonly toasts = signal<ToastMessage[]>([]);

  push(input: Omit<ToastMessage, 'id'>): void {
    const now = Date.now();
    const dedupeKey = `${input.kind}|${input.title}|${input.message}`;
    const lastSeen = this.dedupeCache.get(dedupeKey);

    if (lastSeen && now - lastSeen < this.dedupeWindowMs) {
      return;
    }

    this.dedupeCache.set(dedupeKey, now);
    this.cleanupDedupeCache(now);

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

  private cleanupDedupeCache(now: number): void {
    for (const [key, timestamp] of this.dedupeCache.entries()) {
      if (now - timestamp > this.dedupeWindowMs) {
        this.dedupeCache.delete(key);
      }
    }
  }
}
