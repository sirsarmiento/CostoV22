import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AddBudgetComponent } from './add-budget.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('AddBudgetComponent', () => {
  let component: AddBudgetComponent;
  let fixture: ComponentFixture<AddBudgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddBudgetComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddBudgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize budget form with default control values', () => {
    expect(component.form.get('clasificacion')?.value).toBe('');
    expect(component.form.get('cantidadGlobal')?.value).toBe(1);
    expect(component.form.get('delivery')?.value).toBe(0);
    expect(component.form.get('tasaFalloGlobal')?.value).toBe(0);
  });

  it('should calculate budget totals accurately with material waste, margin and delivery', () => {
    // Configurar pieza de prueba fabricada
    component.piezas = [
      {
        id: 1,
        tipo: 'Fabricada',
        nombre: 'Carcasa 3D',
        cantidad: 2,
        gramos: 100,
        precioMaterial: 0.05, // 100g * 0.05 = $5.00 por pieza * 2 = $10.00
        horas: 1,
        minutos: 30, // 1.5 horas por pieza * 2 = 3.0 horas totales
        materialTipo: 'Filamento PLA'
      }
    ];

    // Configurar parámetros globales del formulario
    component.form.patchValue({
      tasaFalloGlobal: 10, // 10% merma => $10.00 * 1.10 = $11.00 costo material
      tiempoSetup: 30, // 0.5h setup => 3.5h total máquina
      tiempoPostProcesado: 30, // 0.5h post => 4.0h total máquina
      margenGanancia: 40, // 40% margen
      cantidadGlobal: 1,
      delivery: 15
    });

    // Simulamos tasa CIF de $5.00/hora ($500 / 100h) y depreciación de $1.00/hora
    component.totalFijoIndirecto = 500.00;
    component.capacidadHorasMaquina = 100;
    component.tasaDepreciacionMaquina = 1.00;

    const totales = component.getTotales();

    // 4.0 horas totales * $5 CIF = $20.00 indirectos
    // 4.0 horas totales * $1 Dep = $4.00 depreciación
    // Costo Base = $11.00 (Mat) + $20.00 (CIF) + $4.00 (Dep) = $35.00
    // Con 40% margen => Precio Unitario = $35.00 / (1 - 0.40) = $58.33
    // Total Final = ($58.33 * 1) + $15 (Delivery) = $73.33

    expect(totales.totalCostoMaterial).toBeCloseTo(11.00, 2);
    expect(totales.costoIndirectoAsignado).toBeCloseTo(20.00, 2);
    expect(totales.depreciacionAsignada).toBeCloseTo(4.00, 2);
    expect(totales.costoTotalUnitarioBase).toBeCloseTo(35.00, 2);
    expect(totales.precioSugeridoUnitario).toBeCloseTo(58.33, 2);
    expect(totales.costoTotalFinal).toBeCloseTo(73.33, 2);
  });
});
