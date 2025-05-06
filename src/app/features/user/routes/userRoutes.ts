import { Routes } from '@angular/router';
import { registerCampesinoRouter } from './registerCampesinoRouter';
import { RoleGuard } from '../../../core/guard/autorization.guard';

export const userRouter: Routes = [
  {
    path: 'user',
    loadComponent: () => import('../../user/layout/body-user/body-user.component').then(m => m.BodyUserComponent),
    canActivate: [RoleGuard],
    data: { allowedRoles: ['user'] },
    children: [
      ...registerCampesinoRouter,

      {
        path: 'profile',
        loadComponent: () => import('../../profile/component/view-profile/view-profile.component')
          .then(m => m.ViewProfileComponent)
      },
      {
        path: 'dashboard',
        loadComponent: () => import('../../user/components/dashboard-user/dashboard-user.component')
          .then(m => m.DashboardUserComponent)
      },
      {
        path: 'estaciones',
        children: [
          {
            path: '',
            loadComponent: () => import('../../user/components/estaciones/estaciones.component')
              .then(m => m.EstacionesComponent)
          },
          {
            path: 'departamentos',
            loadComponent: () => import('../components/departamentos/departamentos.component')
              .then(m => m.CiudadesComponent)
          },
          {
            path: 'zone',
            loadComponent: () =>
                import('../../visualization/components/zonas-shared/zonas-shared.component')
                    .then(m => m.ZonasSharedComponent) 
         },
          {
            path: 'scene/:zoneId',
            loadComponent: () => import('../../visualization/components/world-viewer/world-viewer.component')
              .then(m => m.WorldViewerComponent) 
          },

        ]
      },
      {
        path: 'productos',
        loadComponent: () =>
          import('../../visualization/components/products/products.component')
            .then(m => m.ProductsComponent),
        data: { mode: 'private' },
      },
      {
        path: 'detalleProducto',
        loadComponent: () =>
          import('../../visualization/components/products/detalle-products/detalle-products.component')
            .then(m => m.DetalleProductsComponent),
        data: { mode: 'private' }
      },

      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];
