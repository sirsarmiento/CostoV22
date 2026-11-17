import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import Swal from 'sweetalert2';
import { SECTORES_COMERCIALES, normalizarSectores } from '../../../../core/utils/client-sectors';

export interface QuickClientData {
  nombre: string;
  rifCedula: string;
  categoria: string;
  sectores?: string[];
  telefono: string;
  email: string;
  direccion: string;
}

@Component({
  selector: 'app-quick-client-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './quick-client-modal.component.html'
})
export class QuickClientModalComponent implements OnInit, OnChanges {
  private fb = inject(FormBuilder);

  @Input() isOpen = false;
  @Input() initialData?: Partial<QuickClientData>;

  @Output() clientConfirmed = new EventEmitter<QuickClientData>();
  @Output() modalClosed = new EventEmitter<void>();

  clientForm!: FormGroup;
  sectoresComerciales = SECTORES_COMERCIALES;

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.initForm();
    }
  }

  private initForm(): void {
    this.clientForm = this.fb.group({
      nombre: [this.initialData?.nombre || '', Validators.required],
      rifCedula: [this.initialData?.rifCedula || ''],
      categoria: [this.initialData?.categoria || ''],
      sectores: [normalizarSectores(this.initialData?.sectores)],
      telefono: [this.initialData?.telefono || ''],
      email: [this.initialData?.email || '', [Validators.email]],
      direccion: [this.initialData?.direccion || '']
    });
  }

  close(): void {
    this.modalClosed.emit();
  }

  confirm(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      Swal.fire('Atención', 'El nombre del cliente o prospecto es obligatorio.', 'warning');
      return;
    }

    const val = this.clientForm.value;
    const clientData: QuickClientData = {
      nombre: String(val.nombre || '').trim(),
      rifCedula: String(val.rifCedula || '').trim(),
      categoria: String(val.categoria || '').trim(),
      sectores: normalizarSectores(val.sectores),
      telefono: String(val.telefono || '').trim(),
      email: String(val.email || '').trim(),
      direccion: String(val.direccion || '').trim()
    };

    this.clientConfirmed.emit(clientData);
    this.close();
  }
}
