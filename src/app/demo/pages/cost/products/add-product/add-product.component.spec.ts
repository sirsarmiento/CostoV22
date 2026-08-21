import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AddProductComponent } from './add-product.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Asset } from '../../../../../core/models/Cost/asset';

describe('AddProductComponent', () => {
  let component: AddProductComponent;
  let fixture: ComponentFixture<AddProductComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddProductComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddProductComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize product form correctly', () => {
    expect(component.form.get('clasificacion')?.value).toBe('');
    expect(component.form.get('piezaCantidad')?.value).toBe(1);
    expect(component.form.get('piezaTipo')?.value).toBe('Del Inventario');
  });

  it('should allow adding manufactured parts to piezasPendientes array', () => {
    component.form.patchValue({
      piezaTipo: 'Fabricada',
      piezaFabricada: 'Tapa Frontal',
      piezaCantidad: 2,
      piezaGramos: 150,
      piezaHoras: 2,
      piezaMinutos: 0,
      piezaMaterialId: 10
    });

    component.activosCirculantes = [
      { id: 10, nombre: 'Filamento ABS', tipo: 'Circulante' } as unknown as Asset
    ];

    component.agregarPieza();

    expect(component.piezasPendientes.length).toBe(1);
    expect(component.piezasPendientes[0]['nombre']).toBe('Tapa Frontal');
    expect(component.piezasPendientes[0]['cantidad']).toBe(2);
  });
});
