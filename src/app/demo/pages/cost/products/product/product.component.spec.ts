import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ProductComponent, ProductWithProfile } from './product.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';

describe('ProductComponent', () => {
  let component: ProductComponent;
  let fixture: ComponentFixture<ProductComponent>;

  const mockProductService = {
    getProducts: () => of([
      {
        id: 1,
        nombre: 'Caja Protectora',
        sku: 'P-FDM-ABS-IND-01',
        clasificacion: 'Producto',
        tecnologia: 'FDM',
        material: 'ABS',
        piezasProducto: [
          { nombre: 'Carcasa Superior', cantidad: 1, tecnologia: 'FDM', gramos: 80 }
        ]
      }
    ]),
    getProduct: (id: number) => of({
      id,
      nombre: 'Caja Protectora',
      sku: 'P-FDM-ABS-IND-01',
      clasificacion: 'Producto',
      tecnologia: 'FDM',
      material: 'ABS',
      piezasProducto: [
        { nombre: 'Carcasa Superior', cantidad: 1, tecnologia: 'FDM', gramos: 80 }
      ]
    })
  };

  const mockConfigService = {
    getConfigs: () => of([])
  };

  const mockAssetService = {
    getAssets: () => of([])
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ProductService, useValue: mockProductService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AssetService, useValue: mockAssetService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create product component', () => {
    expect(component).toBeTruthy();
  });

  it('should detect if a product has pieces using tienePiezas', () => {
    const withPieces: ProductWithProfile = {
      id: 1,
      nombre: 'Pieza A',
      sku: 'P-01',
      clasificacion: 'Producto',
      medida: 'unid',
      descripcion: 'test',
      perfil: 1,
      piezasProducto: [{ nombre: 'P1', cantidad: 1 }]
    };
    const withoutPieces: ProductWithProfile = {
      id: 2,
      nombre: 'Servicio B',
      sku: 'S-01',
      clasificacion: 'Servicio',
      medida: 'unid',
      descripcion: 'test',
      perfil: 1,
      piezasProducto: []
    };

    expect(component.tienePiezas(withPieces)).toBeTrue();
    expect(component.tienePiezas(withoutPieces)).toBeFalse();
  });

  it('should open details modal on onViewDetails', () => {
    const testProd: ProductWithProfile = {
      id: 1,
      nombre: 'Caja Protectora',
      sku: 'P-FDM-ABS-IND-01',
      clasificacion: 'Producto',
      tecnologia: 'FDM',
      material: 'ABS',
      medida: 'unid',
      descripcion: 'Caja para circuito',
      perfil: 1,
      piezasProducto: [
        { nombre: 'Carcasa Superior', cantidad: 1, tecnologia: 'FDM', gramos: 80 }
      ]
    };

    component.onViewDetails(testProd);

    expect(component.showDetailsModal).toBeTrue();
    expect(component.selectedProductForModal).toBeTruthy();
    expect(component.selectedProductForModal?.nombre).toBe('Caja Protectora');
    expect(component.selectedProductForModal?.piezasProducto?.length).toBe(1);
  });

  it('should close details modal on closeDetailsModal', () => {
    const modalProd: ProductWithProfile = {
      id: 1,
      nombre: 'Test',
      sku: 'P-01',
      clasificacion: 'Producto',
      medida: 'unid',
      descripcion: 'test',
      perfil: 1
    };
    component.showDetailsModal = true;
    component.selectedProductForModal = modalProd;

    component.closeDetailsModal();

    expect(component.showDetailsModal).toBeFalse();
    expect(component.selectedProductForModal).toBeNull();
  });
});
