import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BaseService {

  /**
   * resolve the promise with the param
   * @param object Any result 
   */
  resolveWith(object:any):Promise<any>{
    return new Promise((resolve)=>{
      resolve(object);
    });
  }
}
