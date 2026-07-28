import { Injectable, inject } from '@angular/core';
import { BaseService } from './base.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class HttpService extends BaseService {

  protected http = inject(HttpClient);
  /**
   * Execute the GET request to the PeyGold API.
   * @param url Url context.
   * @param options Request options.
   */
  get<T = unknown>(baseUrl: string, url: string, options?: unknown): Observable<T> {
    url = baseUrl + url;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.http.get<T>(url, options as any) as Observable<T>;
  }

  /**
   * Execute the POST request to the PeyGold API.
   * @param url Url context.
   * @param data payload.
   * @param options Request options.
   */
  post<T = unknown>(baseUrl: string, url: string, data?: unknown, options?: unknown): Observable<T> {
    url = baseUrl + url;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.http.post<T>(url, data, options as any) as Observable<T>;
  }

  /**
   * Execute the PUT request to the PeyGold API.
   * @param url Url context.
   * @param data payload.
   * @param options Request options.
   */
  put<T = unknown>(baseUrl: string, url: string, data?: unknown, options?: unknown): Observable<T> {
    url = baseUrl + url;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.http.put<T>(url, data, options as any) as Observable<T>;
  }

  delete<T = unknown>(baseUrl: string, url: string, data?: unknown): Observable<T> {
    url = baseUrl + url;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.http.delete<T>(url, data as any) as Observable<T>;
  }

  /**
 * Execute the GET request to the PeyGold API.
 * @param url Url context.
 * @param options Request options.
 */
  getResource(baseUrl: string, url: string): Observable<Blob> {
    url = baseUrl + url;
    return this.http.get(url, { responseType: 'blob' });
  }

}
