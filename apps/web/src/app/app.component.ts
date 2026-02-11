import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ToastStackComponent } from './shared/components/toast-stack/toast-stack.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastStackComponent],
  template: `
    <div class="shell">
      <header class="shell-header" *ngIf="session() as user">
        <div class="brand">
          <span class="brand-mark">N24</span>
          <div>
            <h1>Notification24</h1>
            <p>{{ user.fullName }} · {{ user.roles.join(', ') }}</p>
          </div>
        </div>

        <nav>
          <a routerLink="/users" routerLinkActive="is-active">Kullanıcılar</a>
          <a routerLink="/tracking" routerLinkActive="is-active">Bildirim Takip</a>
        </nav>

        <div class="header-actions">
          <button type="button" (click)="toggleTheme()">Tema</button>
          <button type="button" class="danger" (click)="logout()">Çıkış</button>
        </div>
      </header>

      <main>
        <router-outlet></router-outlet>
      </main>

      <app-toast-stack></app-toast-stack>
    </div>
  `
})
export class AppComponent {
  readonly session = computed(() => this.authService.currentSession());

  constructor(private readonly authService: AuthService) {}

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  toggleTheme(): void {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') ?? 'light';
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }
}
