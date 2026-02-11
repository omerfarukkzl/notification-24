import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="auth-page">
      <div class="auth-copy">
        <p class="eyebrow">STAJ PROJESI</p>
        <h1>Kullanıcıları yönet, bildirimleri gerçek zamanlı takip et.</h1>
        <p>
          Firebase Authentication ile giriş yapılır. API tarafında Firebase ID token doğrulanır ve tüm yetkiler backend tarafından uygulanır.
        </p>
      </div>

      <form class="auth-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <h2>Giriş</h2>
        <label>
          Email
          <input type="email" formControlName="email" autocomplete="email" />
        </label>

        <label>
          Şifre
          <input type="password" formControlName="password" autocomplete="current-password" />
        </label>

        <button type="submit" [disabled]="form.invalid || loading">{{ loading ? 'Bağlanıyor...' : 'Giriş Yap' }}</button>
      </form>
    </section>
  `
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);

  loading = false;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  constructor(
    private readonly authService: AuthService,
    private readonly toastService: ToastService,
    private readonly router: Router
  ) {}

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    const raw = this.form.getRawValue();

    try {
      await this.authService.signIn(raw.email.trim(), raw.password);
      await this.router.navigate(['/users']);
    } catch (error: unknown) {
      this.toastService.push({
        kind: 'error',
        title: 'Giriş başarısız',
        message: 'Firebase kimlik doğrulaması veya API oturumu başlatılamadı.',
        timeoutMs: 4500
      });
      console.error(error);
    } finally {
      this.loading = false;
    }
  }
}
