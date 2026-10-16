import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ConfiguracionCatalogoComponent } from './configuracion-catalogo.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CodingService } from '../../../../core/services/cost/coding.service';
import { CatalogConfigService } from '../../../../core/services/cost/catalog-config.service';

describe('ConfiguracionCatalogoComponent', () => {
  let component: ConfiguracionCatalogoComponent;
  let fixture: ComponentFixture<ConfiguracionCatalogoComponent>;

  const mockCodingService = {
    getFamilies: () => of([
      { id: 1, codigo: 'LUD', nombre: 'Lúdico' },
      { id: 2, codigo: 'PUB', nombre: 'Publicidad' },
      { id: 3, codigo: 'ROB', nombre: 'Robótica' }
    ])
  };

  const mockCatalogConfigService = {
    getTecnologias: () => of([
      { id: 1, codigo: 'FDM', nombre: 'Fused Deposition Modeling' },
      { id: 2, codigo: 'SLA', nombre: 'Stereolithography' }
    ]),
    getMateriales: () => of([
      { id: 1, codigo: 'PLA', nombre: 'Ácido Poliláctico' }
    ]),
    getMarcas: () => of([
      { id: 1, nombre: 'Overtour' }
    ]),
    getColores: () => of([
      { id: 1, nombre: 'BLACK' }
    ])
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfiguracionCatalogoComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CodingService, useValue: mockCodingService },
        { provide: CatalogConfigService, useValue: mockCatalogConfigService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfiguracionCatalogoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create configuration catalog component', () => {
    expect(component).toBeTruthy();
  });

  it('should paginate familias properly', () => {
    component.pageSize = 2;
    component.currentPage = 1;

    expect(component.totalItems).toBe(3);
    expect(component.totalPages).toBe(2);
    expect(component.familiasPaginadas.length).toBe(2);

    component.setPage(2);
    expect(component.currentPage).toBe(2);
    expect(component.familiasPaginadas.length).toBe(1);
  });

  it('should reset page when changing tab or search', () => {
    component.currentPage = 2;
    component.setActiveTab('tecnologias');

    expect(component.currentPage).toBe(1);
    expect(component.activeTab).toBe('tecnologias');

    component.currentPage = 2;
    component.onSearchChange();
    expect(component.currentPage).toBe(1);
  });

  it('should sort data when sortData is called', () => {
    component.sortData('nombre');
    expect(component.sortColumn).toBe('nombre');
    expect(component.sortAscending).toBe(true);

    component.sortData('nombre');
    expect(component.sortAscending).toBe(false);
  });
});
