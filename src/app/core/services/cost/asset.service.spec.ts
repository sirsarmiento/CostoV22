import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AssetService } from './asset.service';
import { Asset } from '../../models/Cost/asset';

describe('AssetService', () => {
  let service: AssetService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AssetService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(AssetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch assets list via GET', () => {
    const dummyAssets = [
      { id: 1, nombre: 'Impresora 3D', tipo: 'Fijo', costoInicial: 1200, vidaUtil: 5, valorResidual: 200 },
      { id: 2, nombre: 'Filamento PLA', tipo: 'Circulante', valorUnitario: 25, cantidad: 10 }
    ] as unknown as Asset[];

    service.getAssets().subscribe(assets => {
      expect(assets.length).toBe(2);
      expect(assets[0].nombre).toBe('Impresora 3D');
    });

    const req = httpMock.expectOne(req => req.url.includes('/activos') || req.url.includes('/Asset'));
    expect(req.request.method).toBe('GET');
    req.flush(dummyAssets);
  });

  it('should create an asset via POST', () => {
    const newAsset = { nombre: 'Torno CNC', tipo: 'Fijo', costoInicial: 5000, vidaUtil: 10, valorResidual: 500 } as unknown as Asset;

    service.createAsset(newAsset).subscribe(res => {
      expect(res).toBeTruthy();
    });

    const req = httpMock.expectOne(req => req.url.includes('/activo') || req.url.includes('/Asset'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newAsset);
    req.flush({ status: 'success' });
  });
});
