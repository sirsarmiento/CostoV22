import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AssetComponent } from './asset.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Asset } from '../../../../../core/models/Cost/asset';

describe('AssetComponent', () => {
  let component: AssetComponent;
  let fixture: ComponentFixture<AssetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AssetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should normalize string and null values into numbers cleanly', () => {
    expect(component.normalizarNumero(null)).toBe(0);
    expect(component.normalizarNumero(undefined)).toBe(0);
    expect(component.normalizarNumero('150.50')).toBe(150.50);
    expect(component.normalizarNumero('invalid')).toBe(0);
    expect(component.normalizarNumero(200)).toBe(200);
  });

  it('should correctly calculate annual depreciation', () => {
    const asset = {
      nombre: 'Impresora 3D',
      tipo: 'Fijo',
      costoInicial: 1000,
      valorResidual: 100,
      vidaUtil: 10
    } as unknown as Asset;
    // (1000 - 100) / 10 = 90
    const depAnual = component.calcularDepreciacionAnual(asset);
    expect(depAnual).toBe(90);
  });

  it('should correctly calculate monthly depreciation', () => {
    const asset = {
      nombre: 'Impresora 3D',
      tipo: 'Fijo',
      costoInicial: 1000,
      valorResidual: 100,
      vidaUtil: 10
    } as unknown as Asset;
    // (1000 - 100) / 10 / 12 = 7.5
    const depMensual = component.calcularDepreciacionMensual(asset);
    expect(depMensual).toBe(7.5);
  });

  it('should return 0 depreciation when valorResidual exceeds costoInicial or vidaUtil is 0', () => {
    const asset = {
      nombre: 'Equipo Erróneo',
      tipo: 'Fijo',
      costoInicial: 500,
      valorResidual: 600,
      vidaUtil: 5
    } as unknown as Asset;
    expect(component.calcularDepreciacionAnual(asset)).toBe(0);
  });
});
