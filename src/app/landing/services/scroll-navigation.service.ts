import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ScrollNavigationService {
  /** Scroll suave a la sección con el ID dado */
  scrollTo(sectionId: string) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const yOffset = -60;
    const y =
      el.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}
