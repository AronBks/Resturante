import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, filter, map, tap, catchError, throwError, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UploadCloudinaryService {
  private readonly http = inject(HttpClient);

  // Cloudinary Config
  private readonly cloudName = 'dwquu4l5w';
  private readonly uploadPreset = 'tukuypaj_preset';
  private readonly cloudinaryEndpoint = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

  // Signals para estado de carga
  readonly uploading = signal<boolean>(false);
  readonly progress = signal<number>(0);
  readonly error = signal<string | null>(null);

  /**
   * Envía un archivo File a Cloudinary mediante FormData y reporta el progreso mediante Signals.
   * Retorna la URL pública segura ('secure_url' HTTPS).
   */
  uploadImage(file: File): Observable<string> {
    this.uploading.set(true);
    this.progress.set(0);
    this.error.set(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);

    const req = new HttpRequest('POST', this.cloudinaryEndpoint, formData, {
      reportProgress: true,
    });

    return this.http.request<{ secure_url: string }>(req).pipe(
      tap((event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const percent = Math.round((100 * event.loaded) / event.total);
          this.progress.set(percent);
        }
      }),
      filter((event) => event.type === HttpEventType.Response),
      map((event: any) => {
        const secureUrl = event.body?.secure_url as string;
        this.uploading.set(false);
        this.progress.set(100);
        return secureUrl;
      }),
      catchError((err) => {
        this.uploading.set(false);
        this.progress.set(0);
        const errorMsg =
          err?.error?.error?.message || 'Error al subir la imagen a Cloudinary';
        this.error.set(errorMsg);
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  /**
   * Promesa helper para consumo async/await.
   */
  async uploadImageAsync(file: File): Promise<string> {
    return firstValueFrom(this.uploadImage(file));
  }
}
