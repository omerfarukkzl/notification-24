import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/login/login.component';
import { UsersPageComponent } from './features/users/users-page.component';
import { TrackingPageComponent } from './features/tracking/tracking-page.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'users',
    component: UsersPageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'tracking',
    component: TrackingPageComponent,
    canActivate: [authGuard]
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'users'
  },
  {
    path: '**',
    redirectTo: 'users'
  }
];
