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
            // {
            //     path: 'productos',  
            //     loadComponent: () =>
            //         import('../../../users/layaut/products/products.component') 
            //             .then(m => m.ProductsComponent),
            //     data: { mode: 'public' },  
            // },
            // {
            //     path: 'detalleProducto/:id', 
            //     loadComponent: () =>
            //         import('../../../users/layaut/products/detalle-products/detalle-products.component') 
            //             .then(m => m.DetalleProductsComponent),
            //     data: { mode: 'public' }  
            // },
            //  {
            //     path: 'zonas',  
            //     loadComponent: () =>
            //         import('../../../users/layaut/three/zone/zone.component') 
            //             .then(m => m.ZoneComponent),
            //     data: { mode: 'public' }  
            // },
            
            // {
            //     path: 'scene/:zoneId',
            //     loadComponent: () => import('../../../users/layaut/three/scene/scene.component')
            //         .then(m => m.SceneComponent),
            //     data: { mode: 'public' }  
            // },
          
        ]
    }
];
// FIN: inicioRouter.ts