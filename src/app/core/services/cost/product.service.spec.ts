import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ProductService } from './product.service';
import { Product } from '../../models/Cost/product';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProductService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch products list via GET', () => {
    const dummyProducts = [
      { id: 1, nombre: 'Engranaje Industrial', clasificacion: 'Producto', descripcion: 'Pieza de acero' }
    ] as unknown as Product[];

    service.getProducts().subscribe(products => {
      expect(products.length).toBe(1);
      expect(products[0].nombre).toBe('Engranaje Industrial');
    });

    const req = httpMock.expectOne(req => req.url.includes('/producto'));
    expect(req.request.method).toBe('GET');
    req.flush(dummyProducts);
  });

  it('should create a product via POST', () => {
    const newProduct = {
      nombre: 'Soporte Metálico',
      clasificacion: 'Producto',
      descripcion: 'Soporte reforzado',
      margenGanancia: 40
    } as unknown as Product;

    service.createProduct(newProduct).subscribe(res => {
      expect(res).toBeTruthy();
    });

    const req = httpMock.expectOne(req => req.url.includes('/producto'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newProduct);
    req.flush({ status: 'success' });
  });
});
