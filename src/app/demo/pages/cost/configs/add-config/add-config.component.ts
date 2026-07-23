import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { CapacityResults, Config, Machine } from '../../../../../core/models/Cost/config';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-config.component.html'
})
export class AddConfigComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private configService = inject(ConfigService);

  selectedRow: Machine | null = null;
  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;
  showList = true;
  machines: Machine[] = [];
  
  capacidadInstalada = 0;
  capacidadProduccion = 0;
  capacidadOciosa = 0;
  utilizacion = 0;

  activeTab = 'perfil'; // Tab activa por defecto
  groupedCapacities: { medida: string, machines: Machine[], capacities: CapacityResults }[] = [];

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  ngOnInit() {
    this.setValues();
  }

  setActiveTab(tabName: string) {
    this.activeTab = tabName;
  }

  back() {
    this.router.navigate(['/configs']);
  }

  addMachine() {
    const requiredFields = [
      { field: this.f['type_machine'], message: 'el tipo de máquina' },
      { field: this.f['description'], message: 'la descripción' },
      { field: this.f['productMax'], message: 'la producción máxima' },
      { field: this.f['hoursMax'], message: 'las horas máximas' },
      { field: this.f['hoursUse'], message: 'las horas de uso' },
      { field: this.f['medida'], message: 'la unidad de medida' }
    ];

    for (const { field, message } of requiredFields) {
      const value = field.value;
      if (value === null || value === undefined || value === '' || value.toString().trim() === '') {
        Swal.fire('Por Favor', `Debe agregar ${message}`, 'info');
        return;
      }
    }

    const newMachine: Machine = {
      id: this.selectedRow ? this.selectedRow.id : this.generateUniqueMachineId(),
      tipo: this.f['type_machine'].value,
      descripcion: this.f['description'].value,
      prodMaxHoras: Number(this.f['productMax'].value) || 0,
      horasMax: Number(this.f['hoursMax'].value) || 0,
      horasUso: Number(this.f['hoursUse'].value) || 0,
      unidad: this.f['medida'].value
    };

    if (newMachine.horasUso > newMachine.horasMax) {
      Swal.fire('Error', 'Las horas de uso no pueden superar las horas máximas', 'error');
      return;
    }

    if (this.selectedRow) {
      this.machines = this.machines.map(m => m.id === newMachine.id ? newMachine : m);
      this.selectedRow = null;
    } else {
      this.machines.push(newMachine);
    }

    this.calculateGroupedCapacities();
    this.refreshList();
    this.clearForm();
  }

  generateUniqueMachineId(): number {
    return this.machines.length > 0 ? Math.max(...this.machines.map(m => m.id || 0)) + 1 : 1;
  }

  clearForm() {
    this.f['type_machine'].setValue('');
    this.f['description'].setValue('');
    this.f['productMax'].setValue('');
    this.f['hoursMax'].setValue('');
    this.f['hoursUse'].setValue('');
  }

  refreshList() {
    this.showList = false;
    setTimeout(() => this.showList = true, 50);
  }

  calculateGroupedCapacities() {
    const grouped: { [key: string]: Machine[] } = this.machines.reduce((groups: { [key: string]: Machine[] }, machine) => {
      const medida = machine.unidad || 'Sin medida';
      if (!groups[medida]) groups[medida] = [];
      groups[medida].push(machine);
      return groups;
    }, {});

    this.groupedCapacities = Object.keys(grouped).map(medida => {
      const groupMachines = grouped[medida];
      const installed = groupMachines.reduce((sum, m) => sum + (m.horasMax * m.prodMaxHoras), 0);
      const production = groupMachines.reduce((sum, m) => sum + (m.horasUso * m.prodMaxHoras), 0);

      return {
        medida,
        machines: groupMachines,
        capacities: {
          installedCapacity: installed,
          productionCapacity: production,
          idleCapacity: installed - production,
          utilizationPercentage: installed > 0 ? Number(((production / installed) * 100).toFixed(2)) : 0,
          machines: groupMachines.map(m => ({
            machine: m,
            installed: m.horasMax * m.prodMaxHoras,
            production: m.horasUso * m.prodMaxHoras,
            idle: (m.horasMax - m.horasUso) * m.prodMaxHoras
          }))
        }
      };
    });
  }

  onDeleteMachine(row: Machine) {
    Swal.fire({
      title: '¿Está seguro de eliminar esta máquina?',
      text: row.tipo,
      icon: 'warning',
      showDenyButton: true,
      confirmButtonText: `Eliminar`,
      denyButtonText: `Cancelar`
    }).then((result) => {
      if (result.isConfirmed) {
        this.machines = this.machines.filter(m => m.id !== row.id);
        this.calculateGroupedCapacities();
        this.refreshList();
      }
    });
  }

  setValues() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_edit_config');
    if (stored) {
      const data: Config = JSON.parse(stored);
      if (data && data.id && data.id > 0) {
        this.f['nombre'].setValue(data.nombre);
        this.f['tipo'].setValue(data.tipo);
        this.f['sector'].setValue(data.sector);
        this.f['empleados'].setValue(data.empleados);
        this.f['rif'].setValue(data.rif);
        this.f['periodo'].setValue(data.periodo);
        this.f['direccion'].setValue(data.direccion);
        this.f['moneda'].setValue(data.moneda);
        this.f['minMargenGanancia'].setValue(data.margenGanancia || 0);
        this.machines = data.parametros || [];
        this.id = data.id;

        this.calculateGroupedCapacities();
        this.refreshList();
        this.clearForm();
      }
    }
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      nombre: ['', Validators.required],
      tipo: ['', Validators.required],
      sector: ['', Validators.required],
      empleados: ['', Validators.required],
      rif: ['', Validators.required],
      periodo: ['', Validators.required],
      direccion: ['', Validators.required],
      moneda: ['', Validators.required],

      type_machine: [''],
      description: [''],
      productMax: [''],
      hoursMax: [''],
      hoursUse: [''],
      medida: ['Horas máquina'],
      minMargenGanancia: [0, [Validators.min(0), Validators.max(100)]]
    });
  }

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid) {
      this.activeTab = 'perfil'; // Cambiar a la pestaña de datos requeridos
      Swal.fire('Error', 'Complete los datos obligatorios del perfil de la empresa.', 'error');
      return;
    }

    this.loading = true;

    const perfil: Config = {
      id: this.id > 0 ? this.id : 0,
      nombre: this.f['nombre'].value,
      tipo: this.f['tipo'].value,
      sector: this.f['sector'].value,
      empleados: this.f['empleados'].value,
      rif: this.f['rif'].value,
      periodo: this.f['periodo'].value,
      direccion: this.f['direccion'].value,
      moneda: this.f['moneda'].value,
      margenGanancia: Number(this.f['minMargenGanancia'].value) || 0,
      parametros: this.machines
    };

    const request = this.id === 0 
      ? this.configService.createConfig(perfil)
      : this.configService.updateConfig(this.id, perfil);

    request.subscribe({
      next: () => {
        localStorage.removeItem('cost_edit_config');
        this.loading = false;
        Swal.fire({
          title: '¡Guardado!',
          text: 'Perfil de empresa guardado exitosamente.',
          icon: 'success',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#4680ff'
        }).then(() => {
          this.router.navigate(['/configs']);
        });
      },
      error: (error) => {
        this.loading = false;
        console.error('Error saving config:', error);
        Swal.fire('Error', 'Ha ocurrido un error. Intente más tarde.', 'error');
      }
    });
  }

  onEdit(row: Machine) {
    this.f['type_machine'].setValue(row.tipo);
    this.f['description'].setValue(row.descripcion);
    this.f['productMax'].setValue(row.prodMaxHoras);
    this.f['hoursMax'].setValue(row.horasMax);
    this.f['hoursUse'].setValue(row.horasUso);
    this.f['medida'].setValue(row.unidad);
    this.selectedRow = row; 
    window.scrollTo(0, 0);
  }

  cancelEdit() {
    this.clearForm();       
    this.selectedRow = null; 
  }
}
