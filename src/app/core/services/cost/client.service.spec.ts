import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ClientService } from './client.service';
import { Client } from '../../models/Cost/client';

describe('ClientService', () => {
  let service: ClientService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ClientService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ClientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch clients list via GET', () => {
    const dummyClients: Client[] = [
      { id: 1, nombre: 'Empresa', apellido: 'Alpha S.A.', email: 'contacto@alpha.com' }
    ];

    service.getClients().subscribe(clients => {
      expect(clients.length).toBe(1);
      expect(clients[0].nombre).toBe('Empresa');
    });

    const req = httpMock.expectOne(req => req.url.includes('/clientes'));
    expect(req.request.method).toBe('GET');
    req.flush(dummyClients);
  });

  it('should create a client via POST', () => {
    const newClient: Client = { nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com' };

    service.createClient(newClient).subscribe(res => {
      expect(res).toBeTruthy();
    });

    const req = httpMock.expectOne(req => req.url.includes('/cliente'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newClient);
    req.flush({ status: 'success' });
  });
});
