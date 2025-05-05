import { Routes } from '@angular/router';
import { RoleGuard } from '../../../core/guard/autorization.guard';

export const adminRouter: Routes = [

    {
        path: 'admin',
        loadComponent: () => import('../layouts/body-admin/body-admin.component').then(m => m.BodyAdminComponent),
        canActivate: [RoleGuard],
        data: { allowedRoles: ['admin'] },
        children: [
            {
                path: 'profile',
                loadComponent: () => import('../../profile/component/view-profile/view-profile.component')
                    .then(m => m.ViewProfileComponent)
            },
            {
                path: 'dashboard',
                loadComponent: () => import('../components/dashboard-admin/dashboard-admin.component').then(m => m.DashboardAdminComponent)
            },
            {
                path: 'users',
                loadComponent: () => import('../components/user-admin/user-admin.component').then(m => m.UserAdminComponent)
            },

            {
                path: 'user-summary/:id',
                loadComponent: () => import('../components/user-admin/user-summary/user-summary.component').then(m => m.UserSummaryComponent)
            },
            {
                path: 'crearzonas',
                loadComponent: () => import('../components/zones-admin/zones-admin.component').then(m => m.ZonesAdminComponent)
            },
            {
                path: 'zones',
                children: [
                    {
                        // Se carga el componente de estaciones solo cuando se navega a /user/estaciones
                        path: '',
                        loadComponent: () => import('../components/viewzones-admin/viewzones-admin.component')
                            .then(m => m.ViewzonesAdminComponent)
                    },
                    {
                        // Ruta para "scene" con parámetro :zoneId
                        path: 'scene/:zoneId',
                        loadComponent: () => import('../../visualization/components/world-viewer/world-viewer.component')
                            .then(m => m.WorldViewerComponent),
                        canActivate: [RoleGuard],
                        data: { allowedRoles: ['admin'] }
                    }
                ]
            },
            {
                path: '',
                redirectTo: 'dashboard',
                pathMatch: 'full'
            }
        ]
    }
];