import { ApplicationConfig, LOCALE_ID } from '@angular/core';
// Importaciones necesarias del Router para configuración completa
import { provideRouter, withInMemoryScrolling, withPreloading, NoPreloading, Routes } from '@angular/router';
import { provideToastr } from 'ngx-toastr';
import { provideHttpClient, withFetch } from '@angular/common/http';
// provideAnimations es suficiente, no necesitas BrowserAnimationsModule explícito
import { provideAnimations } from '@angular/platform-browser/animations';

// Importaciones NECESARIAS para el locale (¡Correcto!)
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';

// ¡ASEGÚRATE DE QUE ESTE ARCHIVO SOLO EXPORTE EL ARRAY 'routes'!
import { routes } from './app.routes'; // <-- Este archivo define tu array de Routes

// --- REGISTRA EL LOCALE ANTES DE USARLO --- (¡Correcto!)
registerLocaleData(localeEsCo, 'es-CO');
// -----------------------------------------

export const appConfig: ApplicationConfig = {
  providers: [
    // --- Configuración del Router (Reemplaza AppRoutingModule) ---
    provideRouter(
      routes, // Tu array de rutas importado desde app.routes.ts

      // Habilita el scroll restoration y anchor scrolling como lo tenías
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled', // Restaura posición al navegar atrás/adelante
        anchorScrolling: 'enabled',      // Permite scroll a fragmentos (#)
      }),

      // --- ¡¡CAMBIO CRÍTICO PARA RENDIMIENTO!! ---
      // Elimina la precarga inicial de TODOS los módulos lazy.
      // Los módulos/componentes lazy se cargarán SOLO cuando se navegue a ellos.
      withPreloading(NoPreloading)
      // --------------------------------------------
    ),

    // --- Otros providers esenciales ---
    provideHttpClient(withFetch()), // Habilita HttpClient moderno
    provideAnimations(), // Habilita las animaciones de Angular (reemplaza importar BrowserAnimationsModule)
    provideToastr({ // Configuración global de ngx-toastr
      timeOut: 3000,
      positionClass: 'toast-bottom-right',
      preventDuplicates: true,
    }),

    // --- Configuración del Locale --- (¡Correcto!)
    { provide: LOCALE_ID, useValue: 'es-CO' }

    // Nota: Ya no necesitas 'importProvidersFrom(BrowserAnimationsModule)' si usas provideAnimations().
    // Tampoco necesitas importar AppRoutingModule en ningún lado si toda la config está aquí.
  ]
};