import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class ObserversService {
  createObserver(callback: () => void): IntersectionObserver {
    let triggered = false;
    return new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !triggered) {
            triggered = true;
            requestIdleCallback(() => {
              callback();
              observer.disconnect();
            });
          }
        });
      },
      { threshold: 0.5 } // Ajustado para más precisión
    );
  }
}
