import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import {
  Observable,
  filter,
  map,
  tap,
  catchError,
  throwError,
  firstValueFrom,
} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UploadLocalService {
  private readonly http = inject(HttpClient);

  private get uploadEndpoint(): string {
    const host =
      typeof window !== 'undefined' && window.location?.hostname
        ? window.location.hostname
        : 'localhost';
    return `http://${host}:3000/api/carta/imagen/upload`;
  }

  readonly uploading = signal<boolean>(false);
  readonly progress = signal<number>(0);
  readonly error = signal<string | null>(null);

  /**
   * Sube una imagen directamente al servidor local del restaurante (backend/public/platos)
   * y retorna la ruta local relativa (/public/platos/...).
   */
  uploadImage(file: File): Observable<string> {
    this.uploading.set(true);
    this.progress.set(0);
    this.error.set(null);

    const formData = new FormData();
    formData.append('file', file);

    const req = new HttpRequest('POST', this.uploadEndpoint, formData, {
      reportProgress: true,
    });

    return this.http.request<any>(req).pipe(
      tap((event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const percent = Math.round((100 * event.loaded) / event.total);
          this.progress.set(percent);
        }
      }),
      filter((event) => event.type === HttpEventType.Response),
      map((event: any) => {
        const body = event.body;
        const localUrl = (body?.data?.url || body?.url) as string;
        this.uploading.set(false);
        this.progress.set(100);
        return localUrl;
      }),
      catchError((err) => {
        this.uploading.set(false);
        this.progress.set(0);
        const errorMsg =
          err?.error?.message || 'Error al guardar la imagen en el servidor local';
        this.error.set(errorMsg);
        return throwError(() => new Error(errorMsg));
      }),
    );
  }

  async uploadImageAsync(file: File): Promise<string> {
    return firstValueFrom(this.uploadImage(file));
  }
}
