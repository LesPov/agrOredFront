import { Routes } from '@angular/router';

export const  registerCampesinoRouter: Routes = [
    {
        path: 'InfoRegister',
        loadComponent: () => import('../components/info-register/info-register.component').then(m => m.InfoRegisterComponent)   
    },
    {
        path: 'ubicacion',
        loadComponent: () => import('../components/ubicacion-registro/ubicacion-registro.component').then(m => m.UbicacionRegistroComponent)
    },
    {
        path: 'registerCampiamigo',
        loadComponent: () => import('../components/registro-campiamigo/registro-campiamigo.component').then(m => m.RegistroCampiamigoComponent)
    }
];

