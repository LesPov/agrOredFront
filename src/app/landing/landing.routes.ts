// INICIO: inicioRouter.ts
import { Routes } from '@angular/router';

export const inicioRouter: Routes = [
    {
        path: 'inicio',
        loadComponent: () =>
            import('../landing/layouts/body-inicio/body-inicio.component').then(m => m.BodyInicioComponent),
        children: [
            {
                path: '',
                loadComponent: () =>
                    import('../landing/components/inicio/inicio.component').then(m => m.InicioComponent)
            },
            {
                path: 'zonas',
                loadComponent: () =>
                    import('../features/visualization/components/zonas-shared/zonas-shared.component')
                        .then(m => m.ZonasSharedComponent),
                data: { mode: 'public' }
            },

            {
                path: 'scene/:zoneId',
                loadComponent: () => import('../features/visualization/components/world-viewer/world-viewer.component')
                    .then(m => m.WorldViewerComponent),
                data: { mode: 'public' }
            },
            {
                path: 'productos',
                loadComponent: () =>
                    import('../features/admin/components/products/products.component')
                        .then(m => m.ProductsComponent),
                data: { mode: 'public' },
            },
            {
                path: 'detalleProducto/:id',
                loadComponent: () =>
                    import('../features/admin/components/products/detalle-products/detalle-products.component')
                        .then(m => m.DetalleProductsComponent),
                data: { mode: 'public' }
            },


        ]
    }
];
// FIN: inicioRouter.ts