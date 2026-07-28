import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BaseService {

  /**
   * resolve the promise with the param
   * @param object Any result 
   */
  resolveWith<T>(object: T): Promise<T> {
    return new Promise((resolve) => {
      resolve(object);
    });
  }
}
