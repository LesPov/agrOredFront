import { Routes } from '@angular/router';
import { RoleGuard } from '../../../core/guard/autorization.guard';
 
export const campiamigoRouter: Routes = [
  {
    path: 'campesino',
    // Carga perezosa del componente base para el layout del usuario
    loadComponent: () => import('../../campiamigo/layouts/bodycampiamigo/bodycampiamigo.component').then(m => m.BodycampiamigoComponent),
    canActivate: [RoleGuard],
    data: { allowedRoles: ['campesino'] },
    children: [
      // {
      //   path: 'profile',
      //   loadComponent: () => import('../../auth/layout/profile/layout/view-profile/view-profile.component')
      //     .then(m => m.ViewProfileComponent)
      // },
      {
        path: 'dashboard',
        loadComponent: () => import('../../campiamigo/layouts/dashboardcampiamigo/dashboardcampiamigo.component')
          .then(m => m.DashboardcampiamigoComponent)
      },
      // {
      //   path: 'noticias',
      //   loadComponent: () => import('../../campiamigo/layouts/noticiascampiamigos/noticiascampiamigos.component')
      //     .then(m => m.NoticiascampiamigosComponent)
      // },
      // {
      //   path: 'productos',
      //   loadComponent: () => import('../../campiamigo/layouts/productoscampiamigos/productoscampiamigos.component')
      //     .then(m => m.ProductoscampiamigosComponent)
      // },
 
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];
