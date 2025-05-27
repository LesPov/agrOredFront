import { Routes } from '@angular/router';
import { inicioRouter } from './landing/landing.routes';
import { authenticationRoutes } from './features/auth/routes/auth.router';
import { adminRouter } from './features/admin/routes/admin.routes';
import { userRouter } from './features/user/routes/userRoutes';
import { campiamigoRouter } from './features/campiamigo/routes/campiamigoRoutes';

export const routes: Routes = [
    ...inicioRouter,
    ...authenticationRoutes,
    ...adminRouter,
    ...userRouter,
    ...campiamigoRouter,
    { path: 'loading', loadComponent: () => import('./shared/components/loading/loading.component').then(m => m.LoadingComponent) },
    { path: '', redirectTo: '/loading', pathMatch: 'full' },
    { path: '**', redirectTo: '/loading' },
];
