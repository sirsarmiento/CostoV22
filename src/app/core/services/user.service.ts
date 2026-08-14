import { Injectable, inject } from '@angular/core';
import { HttpService } from './http.service';
import { environment } from '../../../environments/environment';
import { User, userObservable } from '../models/user';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { SelectOption } from '../models/select-option';
import { Responsibles } from '../models/Cost/config';
import { Company } from '../models/company';
import { PaginationResponse } from '../models/pagination-response';

@Injectable({
  providedIn: 'root'
})
export class UserService extends HttpService {
  private authService = inject(AuthService);

  private sharingUserObservable: BehaviorSubject<userObservable> = new BehaviorSubject<userObservable>({
    id: 0,
    firstName: '',
    secondName: '',
    lastName: '',
    secondLastName: '',
    email: '',
    documentType: '',
    documentNumber: '',
    birthDate: '',
    sex: '',
    address: '',
    position: new SelectOption('', ''),
    country: new SelectOption('', ''),
    state: new SelectOption('', ''),
    city: new SelectOption('', ''),
    roles: '',
    idestructura: 0
  });

  get userObservable() {
    return this.sharingUserObservable.asObservable();
  }

  set userObservableData(data: userObservable) {
    this.sharingUserObservable.next(data);
  }

  getAll() { // Add by Sir for getting responsibles
    return this.http.get<Responsibles[]>(`${environment.apiUrl}/user`);
  }

  /**
     * Get info of user
     */
  async getInfoUser() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any = await firstValueFrom(this.get(environment.apiUrl, '/user/info/detalle'));
    const user = new User();
    user.id = resp[0].id;
    user.token = this.authService.currentUser?.token;
    user.firstName = resp[0].primerNombre;
    user.lastName = resp[0].primerApellido;
    user.secondName = resp[0].segundoNombre;
    user.secondLastName = resp[0].segundoApellido;
    user.email = resp[0].email;
    user.position = new SelectOption(resp[0].cargo.id, resp[0].cargo.Descripcion);
    user.phones = resp[0].telefonos;
    user.birthDate = resp[0].fechaNacimiento;
    user.documentType = resp[0].tipoDocumentoIdentidad;
    user.documentNumber = resp[0].numeroDocumento;
    user.status = new SelectOption(resp[0].status.id, resp[0].status.Descripcion);
    user.avatar = resp[0].foto;
    user.createAt = resp[0].createAt;
    user.updateAt = resp[0].updateAt;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user.roles = resp[0].roles.map((itemRol: any) => {
      return itemRol.rol;
    })

    //this.permissionsService.loadPermissions(user.roles) // Add by Sir for getting permissions
    let datauserresorce = '';

    //var repotsAct = resp[0].roles.filter((item) => item.rol == 'ROLE_STAEXPED_REPORTS');

    //if (repotsAct.length != 0) {
    //datauserresorce = 'true';
    //} else {
    //datauserresorce = 'false';
    //}

    const jsonData = JSON.stringify(datauserresorce)
    localStorage.setItem('arrayUsersRepots', jsonData)

    user.instrumentsPending = resp[0].instrumentosPendientes && resp[0].instrumentosPendientes.length > 0 ? resp[0].instrumentosPendientes : null;
    user.sex = resp[0].sexo
    user.address = resp[0].direccion;
    user.country = new SelectOption(resp[0].pais?.id, resp[0].pais.Nombre);
    user.state = new SelectOption(resp[0].estado?.id, resp[0].estado.Nombre);
    user.city = new SelectOption(resp[0].ciudad?.id, resp[0].ciudad.Nombre);

    if (resp[0].redes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user.socialNetwork = resp[0].redes.map((item: any) => {
        return { idTipo: item.idTipo, label: null, networkDir: item.red }
      });
    }

    if (resp[0].empresa) {
      user.company = new Company();
      user.company.id = resp[0].empresa.id;
      user.company.name = resp[0].empresa.Nombre;
      user.company.logo = resp[0].empresa.url_logo;
    }

    this.authService.saveUserInLocalstorage(user);
    return user;

  }

  /**
   * Check all users, supports pagination and filter
   * @param filter 
   * @returns 
   */
  async getUsersPaginated(filter: any): Promise<PaginationResponse> {
    const resp: any = await firstValueFrom(this.post(environment.apiUrl, '/user/all', filter));
    const paginator = new PaginationResponse(filter.page, filter.rowByPage);
    paginator.count = resp ? resp.count : 0;
    const items = resp && resp.data ? resp.data : [];
    paginator.data = items.map((item: any) => {
      return User.mapFromObject(item);
    }).filter((u: any) => u !== undefined);
    return paginator;
  }

  /**
   * Query user by id
   * @param id 
   * @returns 
   */
  async getUserById(id: number): Promise<User | undefined> {
    const resp: any = await firstValueFrom(this.get(environment.apiUrl, `/user/${id}`));
    if (resp && resp.length > 0) {
      return User.mapFromObject(resp[0]);
    }
    return undefined;
  }

  /**
   * Delete user by id
   * @param id 
   */
  async deleteUser(id: number) {
    await firstValueFrom(this.delete(environment.apiUrl, `/user/${id}`));
  }

  /**
   * Persists user data
   * @param data 
   */
  async storeUser(data: any) {
    if (data.id) {
      const id = data.id;
      delete data.id;
      return await firstValueFrom(this.put(environment.apiUrl, `/user/${id}`, data));
    } else {
      return await firstValueFrom(this.post(environment.apiUrl, '/user', data));
    }
  }
}
