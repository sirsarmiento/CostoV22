import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class HttpService extends BaseService {

  constructor(protected http: HttpClient) {
    super();
  }
  /**
   * Execute the GET request to the PeyGold API.
   * @param url Url context.
   * @param options Request options.
   */
  get(baseUrl: string, url: string, options?: any): Observable<any> {
    url = baseUrl + url;
    return this.http.get(url, options);
  }

  /**
   * Execute the POST request to the PeyGold API.
   * @param url Url context.
   * @param data payload.
   * @param options Request options.
   */
  post(baseUrl: string, url: string, data?: any, options?: any): Observable<any> {
    url = baseUrl + url;
    return this.http.post(url, data, options);
  }

  /**
   * Execute the PUT request to the PeyGold API.
   * @param url Url context.
   * @param data payload.
   * @param options Request options.
   */
  put(baseUrl: string, url: string, data?: any, options?: any): Observable<any> {
    url = baseUrl + url;
    return this.http.put(url, data, options);
  }

  delete(baseUrl: string, url: string, data?: any): Observable<any> {
    url = baseUrl + url;
    return this.http.delete(url, data);
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
