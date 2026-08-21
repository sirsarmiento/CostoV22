import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BudgetService } from './budget.service';
import { Budget } from '../../models/Cost/budge';

describe('BudgetService', () => {
  let service: BudgetService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BudgetService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(BudgetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch budgets list via GET', () => {
    const dummyBudgets: Budget[] = [
      { id: 1, clasificacion: 'Servicio', descripcion: 'Pieza personalizada', numero: 'ORD-001', fecha: new Date(), piezas: [] }
    ];

    service.getBudgets().subscribe(budgets => {
      expect(budgets.length).toBe(1);
      expect(budgets[0].numero).toBe('ORD-001');
    });

    const req = httpMock.expectOne(req => req.url.includes('/presupuesto'));
    expect(req.request.method).toBe('GET');
    req.flush(dummyBudgets);
  });

  it('should save a new budget via POST', () => {
    const dummyBudget: Budget = {
      clasificacion: 'Producto',
      descripcion: 'Carcasa Protectora',
      numero: 'ORD-002',
      fecha: new Date(),
      cantidadGlobal: 5,
      delivery: 10,
      piezas: []
    };

    service.createBudget(dummyBudget).subscribe(res => {
      expect(res).toBeTruthy();
    });

    const req = httpMock.expectOne(req => req.url.includes('/presupuesto'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dummyBudget);
    req.flush({ status: 'success' });
  });
});
