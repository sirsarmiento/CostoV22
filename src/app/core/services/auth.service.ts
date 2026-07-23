import { environment } from './../../../environments/environment';
import { HttpService } from './http.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, } from 'rxjs';

import { ToastrService } from 'ngx-toastr';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class AuthService extends HttpService {

  private userSource: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);
  asObservable = this.userSource.asObservable();

  constructor(protected override http: HttpClient,
    private toastrService: ToastrService) {
    super(http);
  }

  /**
   * Get current user from local
   */
  public get currentUser(): User | null {

    const info = localStorage.getItem(environment.localstorage.userKey) || null;
    if (!info) {
      return null;
    }
    const item = JSON.parse(info);
    const now = new Date();
    if (now.getTime() > item.expiry) {
      localStorage.removeItem(environment.localstorage.userKey)
      return null
    }
    const user = User.map(item.user);
    return user;
  }


  /**
 * Save user data to localstorage
 * @param key 
 * @param value 
 * @param ttl 
 */
  saveUserInLocalstorage(value: User) {
    const user = localStorage.getItem(environment.localstorage.userKey);
    if (user) {
      localStorage.removeItem(environment.localstorage.userKey);
    }
    const now = new Date();
    const item = {
      user: value,
      expiry: now.getTime() + environment.ttl,
    }
    console.log('user >>>>', item);
    localStorage.setItem(environment.localstorage.userKey, JSON.stringify(item));
  }

  updateUserSource(user: User) {
    this.userSource.next(user);
  }

  /**
   * Get authentication
   * @param username 
   * @param password 
   * @returns 
   */
  async login(username: string, password: string): Promise<User | string> {

    try {
      const resp = await firstValueFrom(this.post(environment.apiUrl, '/login_check', { username, password }));
      const user = new User();
      user.token = resp.token;
      this.saveUserInLocalstorage(user);
      return user;
    } catch (error: any) {
      if (error.error.code == 401) {
        return 'Usuario / Password inválido.' as string;
      }
      return 'Ha ocurrido un error. Intente más tarde.' as string;
    }


  }
  /**
   * Close sesion
   */
  logout() {
    localStorage.removeItem('cusr');
  }


  /**
   * Check if the user is logged in
   * @returns 
   */
  isLoggedIn(): boolean {
    const currentUser = this.currentUser || null;
    if (currentUser) {
      return true;
    }
    return false;
  }

  /**
   * Init process recovery password
   * @param email 
   * @returns 
   */
  async initRecoverPass(email: string): Promise<any> {
    try {
      const resp = await firstValueFrom(this.post(environment.apiUrl, '/account/recovery-password', { email }));
      this.toastrService.success('', 'Le fué enviado un email con éxito para que restablezca su password.');
    } catch (error: any) {

      if (error.status == 404) {
        this.toastrService.error('', 'No existe el correo electrónico.');
        return;
      }
      this.toastrService.error('', 'Ha ocurrido un error. Intente más tarde.');

      return;
    }
  }

  /**
   * Reset password
   * @param data 
   * @returns 
   */
  async resetPass(data: any): Promise<any> {
    try {
      await firstValueFrom(this.post(environment.apiUrl, '/user/changepassword/perfil', data));
      this.toastrService.success('', 'Su password fué restablecido con éxito.');
      return true;
    } catch (error: any) {
      console.log(error)
      if (error.status == 409) {
        this.toastrService.error('', 'El tiempo establecido para restablecer password ha caducado. Inicie nuevamente el proceso.');
        return false;
      }
      if (error.status != 500) {
        this.toastrService.error('', 'Ha ocurrido un error. Intente más tarde.');
      }
      return false;
    }

  }


}
