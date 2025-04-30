import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BotInfoService {
  private currentInfoList: string[] = [];
  private infoIndexSubject = new BehaviorSubject<number>(0);
  private scrollIndexSubject = new BehaviorSubject<number>(0);
  private isPaused = false;
  private isSpeaking = false;
  private isSpeakingSubject = new BehaviorSubject<boolean>(false);

  constructor(private zone: NgZone) {}

  // Método para cargar el script de ResponsiveVoice dinámicamente
  private loadResponsiveVoiceScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any)['responsiveVoice']) {
        // Si ya existe, iniciamos si es necesario
        if (typeof (window as any)['responsiveVoice'].init === 'function') {
          (window as any)['responsiveVoice'].init();
        }
        resolve();
      } else {
        const script = document.createElement('script');
        script.src = 'https://code.responsivevoice.org/responsivevoice.js?key=m9Sj3g80';
        script.async = true;
        script.onload = () => {
          // Forzamos la inicialización de ResponsiveVoice
          if ((window as any)['responsiveVoice'] && typeof (window as any)['responsiveVoice'].init === 'function') {
            (window as any)['responsiveVoice'].init();
            console.log('ResponsiveVoice se ha inicializado correctamente.');
          } else {
            console.warn('No se pudo inicializar responsiveVoice.');
          }
          resolve();
        };
        script.onerror = () => reject('Error al cargar el script de ResponsiveVoice');
        document.body.appendChild(script);
      }
    });
  }

  setInfoList(infoList: string[]): void {
    this.currentInfoList = infoList;
    this.infoIndexSubject.next(0);
  }

  getNextInfo(): string {
    const currentIndex = this.infoIndexSubject.value;
    if (this.currentInfoList.length === 0) return "No hay información disponible.";
    const info = this.currentInfoList[currentIndex];
    this.infoIndexSubject.next((currentIndex + 1) % this.currentInfoList.length);
    return info;
  }

  getIsSpeaking(): Observable<boolean> {
    return this.isSpeakingSubject.asObservable();
  }

  getSingleInfo(): string {
    return this.currentInfoList.length > 0 ? this.currentInfoList[0] : "No hay información disponible.";
  }

  getScrollIndex(): Observable<number> {
    return this.scrollIndexSubject.asObservable();
  }

  async speak(text: string): Promise<void> {
    try {
      await this.loadResponsiveVoiceScript();
      if ((window as any)['responsiveVoice']) {
        this.cancelSpeak();
        this.isSpeaking = true;
        this.zone.run(() => this.isSpeakingSubject.next(true));

        console.log('Iniciando la reproducción de voz:', text);
        (window as any)['responsiveVoice'].speak(text, "Spanish Latin American Female", {
          pitch: 1.1,
          rate: 1.0,
          onend: () => {
            this.zone.run(() => {
              this.isSpeaking = false;
              this.isSpeakingSubject.next(false);
              console.log('Finalizó la reproducción.');
            });
          },
          onerror: (error: any) => {
            this.zone.run(() => {
              this.isSpeaking = false;
              this.isSpeakingSubject.next(false);
            });
            console.error('Error en responsiveVoice:', error);
          }
        });
      } else {
        throw new Error('ResponsiveVoice no está disponible.');
      }
    } catch (error) {
      console.error(error);
    }
  }

  pauseSpeak(): void {
    if ((window as any)['responsiveVoice'] && this.isSpeaking && !this.isPaused) {
      (window as any)['responsiveVoice'].pause();
      this.isPaused = true;
      console.log('Reproducción pausada.');
    }
  }

  resumeSpeak(): void {
    if ((window as any)['responsiveVoice'] && this.isPaused) {
      (window as any)['responsiveVoice'].resume();
      this.isPaused = false;
      console.log('Reproducción resumida.');
    }
  }

  cancelSpeak(): void {
    if ((window as any)['responsiveVoice']) {
      (window as any)['responsiveVoice'].cancel();
      this.isPaused = false;
      this.isSpeaking = false;
      this.zone.run(() => this.isSpeakingSubject.next(false));
      console.log('Reproducción cancelada.');
    }
  }

  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  // Combina la lectura y la emisión del índice para scroll
  speakNextAndScroll(): Promise<void> {
    const currentIndex = this.infoIndexSubject.value;
    const text = this.getNextInfo();
    this.scrollIndexSubject.next(currentIndex);
    return this.speak(text);
  }
}
