import { Routes } from '@angular/router';
import { inicioRouter } from './landing/landing.routes';

export const routes: Routes = [
    ...inicioRouter,
    // ...authenticationRoutes,
    // ...adminRouter,
    // ...userRouter,
    // ...campiamigoRouter,
    { path: 'loading', loadComponent: () => import('./shared/components/loading/loading.component').then(m => m.LoadingComponent) },
    { path: '', redirectTo: '/loading', pathMatch: 'full' },
    { path: '**', redirectTo: '/loading' },
];
 