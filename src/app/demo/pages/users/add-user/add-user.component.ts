import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators, FormArray, FormControl, AbstractControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { User } from '../../../../core/models/user';
import { UserService } from '../../../../core/services/user.service';
import { CommonsService } from '../../../../core/services/commons.service';
import { RolesPermissionsService } from '../../../../core/services/roles-permissions.service';
import { StructureService } from '../../../../core/services/structure.service';
import { SelectOption } from '../../../../core/models/select-option';
import { NgSelectModule } from '@ng-select/ng-select';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-user.component.html'
})
export class AddUserComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private commonsService = inject(CommonsService);
  private rolesService = inject(RolesPermissionsService);
  private structureService = inject(StructureService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  unamePattern = "^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]{3,30}$"; 
  uidPattern = "^[VEJGPvejgp][0-9]{7,9}$"; 
  loading = false;
  submitted = false;
  formLoading = false;
  form!: FormGroup;
  id: number = 0;
  idEstructura: number = 0;

  states: Array<SelectOption> = [];
  cities: Array<SelectOption> = [];
  positions: Array<SelectOption> = [];
  roles: Array<SelectOption> = [];
  countries: Array<SelectOption> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  levelsData: any[][] = [[]]; 

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  async ngOnInit() {
    this.formLoading = true;
    try {
      await Promise.all([
        this.commonsService.getAllCountries().then(res => this.countries = res).catch(e => console.error('Error cargando países', e)),
        this.commonsService.getAllPositions().then(res => this.positions = res).catch(e => console.error('Error cargando cargos', e)),
        this.commonsService.getAllRoles().then(res => this.roles = res).catch(e => {
          console.error('Error cargando roles', e);
          this.roles = [
            new SelectOption('Administrador', 'Administrador'),
            new SelectOption('Usuario Normal', 'Usuario Normal')
          ];
        })
      ]);

      this.getStructure();
      await this.setValues();
    } catch (error) {
      console.error('Error initializing form data', error);
    } finally {
      this.formLoading = false;
      this.cdr.detectChanges();
    }
  }

  getStructure() {
    this.structureService.getAll().subscribe({
      next: (resp: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (resp as any).data || resp;
        console.log('getStructure API response data:', data);
        setTimeout(() => {
          this.levelsData = [data]; 
          this.levelsFormArray.clear(); 
          this.levelsFormArray.push(this.formBuilder.control('')); 
          this.cdr.detectChanges();
        });
      },
      error: (err: unknown) => {
        console.error('Error cargando estructura organizativa', err);
        // Fallback Mocks para estructura organizativa
        setTimeout(() => {
          this.levelsData = [[
            { id: 1, descripcion: 'Dirección General' },
            { id: 2, descripcion: 'Recursos Humanos' },
            { id: 3, descripcion: 'Operaciones' }
          ]];
          this.levelsFormArray.clear(); 
          this.levelsFormArray.push(this.formBuilder.control('')); 
          this.cdr.detectChanges();
        });
      }
    });
  }

  onLevelChange(levelIndex: number, id: unknown): void {
    const numId = id ? Number(id) : 0;
    
    // Cortar niveles inferiores en la data
    this.levelsData = this.levelsData.slice(0, levelIndex + 1);
    
    // Sincronizar el FormArray de niveles organizativos
    while (this.levelsFormArray.length > levelIndex + 1) {
      this.levelsFormArray.removeAt(this.levelsFormArray.length - 1);
    }

    if (!numId) {
      // Si selecciona "Seleccione", idEstructura vuelve al nivel superior (si existe) o a 0
      this.idEstructura = levelIndex > 0 ? Number(this.levelsFormArray.at(levelIndex - 1).value) : 0;
      this.cdr.detectChanges();
      return;
    }

    this.idEstructura = numId;

    this.structureService.getById(numId).subscribe((resp: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (resp as any).data || resp;
      console.log(`onLevelChange (levelIndex: ${levelIndex}, id: ${numId}) API response data:`, data);
      
      setTimeout(() => {
        if (data && data.length > 0) {
          this.levelsData.push(data);
          this.levelsFormArray.push(this.formBuilder.control(''));
        }
        this.cdr.detectChanges();
      });
    });
  }

  get levelsFormArray(): FormArray {
    return this.form.get('levels') as FormArray;
  }

  getLevelControl(index: number): FormControl {
    return this.levelsFormArray.at(index) as FormControl;
  }

  async setValues() {
    const stored = localStorage.getItem('security_edit_user');
    if (stored) {
      const data: User = JSON.parse(stored);
      if (data && data.id && data.id > 0) {
        this.id = data.id;
        this.f['firstName'].setValue(data.firstName);
        this.f['secondName'].setValue(data.secondName);
        this.f['lastName'].setValue(data.lastName);
        this.f['secondLastName'].setValue(data.secondLastName);
        this.f['documentType'].setValue(data.documentType);
        this.f['documentNumber'].setValue(data.documentNumber);
        
        if (data.birthDate) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bd: any = data.birthDate;
          if (bd.year) {
             const month = bd.month.toString().padStart(2, '0');
             const day = bd.day.toString().padStart(2, '0');
             this.f['birthDate'].setValue(`${bd.year}-${month}-${day}`);
          } else {
             this.f['birthDate'].setValue(bd);
          }
        }
        
        this.f['sex'].setValue(data.sex);
        this.f['email'].setValue(data.email);
        this.f['address'].setValue(data.address);
        
        if (data.position && data.position.value) this.f['position'].setValue(data.position.value);
        
        const promises: Promise<void>[] = [];
        if (data.country && data.country.value) {
           this.f['country'].setValue(data.country.value);
           promises.push(
             this.commonsService.getAllStates(Number(data.country.value))
               .then(res => { this.states = res; })
               .catch(e => console.error(e))
           );
        }
        if (data.state && data.state.value) {
           this.f['state'].setValue(data.state.value);
           promises.push(
             this.commonsService.getAllCities(Number(data.state.value))
               .then(res => { this.cities = res; })
               .catch(e => console.error(e))
           );
        }

        if (promises.length > 0) {
          await Promise.all(promises);
        }

        if (data.city && data.city.value) {
           this.f['city'].setValue(data.city.value);
        }

        if (data.roles) {
           this.setRolesSeleccionados(data.roles as Array<string | { rol: string }>);
        }
        this.idEstructura = data.idestructura;
        this.cdr.detectChanges();
      }
    }
  }

  setRolesSeleccionados(rolesGuardados: Array<string | { rol: string }>) {
    const formArray = this.form.get('roles') as FormArray;
    formArray.clear(); 
    rolesGuardados.forEach(r => {
      const roleName = typeof r === 'string' ? r : r.rol;
      if (!formArray.value.includes(roleName)) {
        formArray.push(new FormControl(roleName));
      }
    });
  }

  isChecked(value: string): boolean {
    const formArray = this.form.get('roles') as FormArray;
    return formArray.value.includes(value);
  } 

  ngOnDestroy() {
    localStorage.removeItem('security_edit_user');
  }

  async onCountryChange(countryId: number | string) {
    if (!countryId) {
      this.states = [];
      this.cities = [];
      this.f['state'].setValue('');
      this.f['city'].setValue('');
      this.cdr.detectChanges();
      return;
    }
    this.states = await this.commonsService.getAllStates(Number(countryId));
    this.cities = [];
    this.f['state'].setValue('');
    this.f['city'].setValue('');
    this.cdr.detectChanges();
  }

  async onStateChange(stateId: number | string) {
    if (!stateId) {
      this.cities = [];
      this.f['city'].setValue('');
      this.cdr.detectChanges();
      return;
    }
    this.cities = await this.commonsService.getAllCities(Number(stateId));
    this.f['city'].setValue('');
    this.cdr.detectChanges();
  }

  back() {
    this.router.navigate(['/users']);
  }

  async onSubmit() {
    this.submitted = true;

    if (this.form.invalid) {
      Swal.fire('Error', 'Por favor, revise los campos marcados en rojo.', 'warning');
      return;
    }

    this.loading = true; 
    
    // Armar roles format
    const formRoles = this.form.get('roles')?.value || [];
    const rolesObj = formRoles.map((r: string) => ({ rol: r }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = {
      id: this.id,
      idStatus: 1,
      documentNumber: this.f['documentNumber'].value,
      documentType: this.f['documentType'].value,
      firstName: this.f['firstName'].value,
      secondName: this.f['secondName'].value,
      lastName: this.f['lastName'].value,
      secondLastName: this.f['secondLastName'].value,
      birthDate: this.f['birthDate'].value,
      address: this.f['address'].value,
      sex: this.f['sex'].value,
      email: this.f['email'].value,
      position: this.f['position'].value,
      roles: rolesObj, 
      country: this.f['country'].value,
      state: this.f['state'].value,
      city: this.f['city'].value,
      idempresa: null,
      idestructura: this.idEstructura
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = User.mapForPost(user as any);

    try {
       await this.userService.storeUser(payload);
       Swal.fire('Éxito', 'Usuario guardado correctamente.', 'success');
       this.router.navigate(['/users']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
       this.loading = false;
       if (error.status == 409) {
         Swal.fire('Error', error.error?.msg || 'Conflicto de datos', 'error');
       } else {
         Swal.fire('Error', 'Ha ocurrido un error. Intente más tarde.', 'error');
       }
    }
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      firstName: ['', [Validators.pattern(this.unamePattern), Validators.maxLength(25), Validators.minLength(3), Validators.required]],
      secondName: ['', [Validators.pattern(this.unamePattern), Validators.maxLength(25), Validators.minLength(3)]],
      lastName: ['', [Validators.pattern(this.unamePattern), Validators.maxLength(25), Validators.minLength(3), Validators.required]],
      secondLastName: ['', [Validators.pattern(this.unamePattern), Validators.maxLength(25), Validators.minLength(3)]],
      documentType: ['', Validators.required],
      documentNumber: ['', Validators.compose([Validators.required])],
      birthDate: ['', Validators.required],
      country: ['', Validators.required],
      state: ['', Validators.required],
      city: ['', Validators.required],
      sex: ['', Validators.required],
      email: ['', [Validators.email, Validators.required]],
      address: ['', [Validators.minLength(10), Validators.maxLength(150), Validators.required]],
      position: ['', Validators.required],
      levels: this.formBuilder.array([
        this.formBuilder.control('') 
      ]),
      roles: this.formBuilder.array([]),
      username: [''],
    });
  }

  onCheckChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const formArray: FormArray = this.form.get('roles') as FormArray;
    if (target.checked) {
      formArray.push(new FormControl(target.value));
    } else {
      let i: number = 0;
      formArray.controls.forEach((ctrl: AbstractControl) => {
        if (ctrl.value == target.value) {
          formArray.removeAt(i);
          return;
        }
        i++;
      });
    }
  }
}
