import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SelectOption } from '../models/select-option';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CommonsService {
  private http = inject(HttpClient);

  async getAllPositions(): Promise<Array<SelectOption>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/cargo/list`));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return resp.data.map((item: any) => new SelectOption(item.id, item.descripcion));
  }

  async getAllCountries(): Promise<Array<SelectOption>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/pais/List`));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return resp.data.map((item: any) => new SelectOption(item.id, item.nombre));
  }

  async getAllStates(countryId: number): Promise<Array<SelectOption>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/estado/pais/${countryId}`));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return resp.map((item: any) => new SelectOption(item.id, item.nombre));
  }

  async getAllCities(stateId: number): Promise<Array<SelectOption>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/ciudad/estado/${stateId}`));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return resp.map((item: any) => new SelectOption(item.id, item.nombre));
  }
  async getAllRoles(): Promise<Array<SelectOption>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/rol/list`));
    const temp = resp[0] || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return temp.map((item: any) => new SelectOption(item.descripcion || item.name || item.rol, item.descripcion || item.name || item.rol));
  }
}
