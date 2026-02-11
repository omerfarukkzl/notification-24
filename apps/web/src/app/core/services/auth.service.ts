import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { environment } from '../config/environment';
import { firebaseAuth } from '../config/firebase';
import { SessionUser } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebaseUser = signal<User | null>(null);
  private readonly session = signal<SessionUser | null>(null);
  private readonly initialized = signal(false);

  readonly isAuthenticated = computed(() => this.firebaseUser() !== null && this.session() !== null);
  readonly currentSession = computed(() => this.session());

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    onAuthStateChanged(firebaseAuth, async (user) => {
      this.firebaseUser.set(user);

      if (user) {
        try {
          await this.refreshSession();
        } catch {
          this.session.set(null);
        }
      } else {
        this.session.set(null);
      }

      this.initialized.set(true);
    });
  }

  async waitUntilReady(): Promise<void> {
    if (this.initialized()) {
      return;
    }

    await new Promise<void>((resolve) => {
      const interval = window.setInterval(() => {
        if (this.initialized()) {
          window.clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
    await this.refreshSession();
  }

  async logout(): Promise<void> {
    await signOut(firebaseAuth);
    this.session.set(null);
    await this.router.navigate(['/login']);
  }

  async getIdToken(forceRefresh = false): Promise<string | null> {
    const user = firebaseAuth.currentUser;
    if (!user) {
      return null;
    }

    return user.getIdToken(forceRefresh);
  }

  async refreshSession(): Promise<void> {
    await this.getIdToken(true);
    const session = await firstValueFrom(this.http.get<SessionUser>(`${environment.apiBaseUrl}/api/auth/me`));
    this.session.set(session);
  }

  async handleUnauthorized(): Promise<void> {
    await this.logout();
  }
}
