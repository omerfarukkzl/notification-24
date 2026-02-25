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
        <p class="form-alert error" *ngIf="formError">{{ formError }}</p>
        <label>
          Email
          <input
            type="email"
            formControlName="email"
            autocomplete="email"
            [attr.aria-invalid]="!!controlError('email')"
          />
          <small class="field-error" *ngIf="controlError('email') as error">{{ error }}</small>
        </label>

        <label>
          Şifre
          <input
            type="password"
            formControlName="password"
            autocomplete="current-password"
            [attr.aria-invalid]="!!controlError('password')"
          />
          <small class="field-error" *ngIf="controlError('password') as error">{{ error }}</small>
        </label>

        <button type="submit" [disabled]="form.invalid || loading">{{ loading ? 'Bağlanıyor...' : 'Giriş Yap' }}</button>
      </form>
    </section>
  `
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);

  loading = false;
  formError = '';

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
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.formError = '';
    const raw = this.form.getRawValue();

    try {
      await this.authService.signIn(raw.email.trim(), raw.password);
      await this.router.navigate(['/users']);
    } catch (error: unknown) {
      this.formError = 'Giriş doğrulanamadı. Email ve şifreyi kontrol edip tekrar dene.';
      this.toastService.push({
        kind: 'error',
        title: 'Giriş başarısız',
        message: this.formError,
        timeoutMs: 6500
      });
      console.error(error);
    } finally {
      this.loading = false;
    }
  }

  controlError(field: 'email' | 'password'): string | null {
    const control = this.form.controls[field];
    if (!control.touched || !control.invalid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Bu alan zorunludur.';
    }

    if (control.hasError('email')) {
      return 'Geçerli bir email gir.';
    }

    return null;
  }
}
