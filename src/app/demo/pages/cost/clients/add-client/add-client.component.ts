import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { ClientService } from '../../../../../core/services/cost/client.service';
import { Client } from '../../../../../core/models/Cost/client';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-client',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-client.component.html'
})
export class AddClientComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private clientService = inject(ClientService);
  private cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  loading = false;
  submitted = false;
  id = 0;
  nacionalidadesList = ['V', 'E', 'J', 'G', 'P'];

  constructor() {
    this.initForm();
  }

  parseCedula(rawCedula: string): { nac: string; num: string } {
    const clean = String(rawCedula || '').trim();
    if (!clean) return { nac: 'V', num: '' };
    const match = clean.match(/^([VEJGP])[-_ ]*(.*)$/i);
    if (match) {
      return { nac: match[1].toUpperCase(), num: match[2] };
    }
    return { nac: 'V', num: clean };
  }

  ngOnInit(): void {
    const editClient: Client | undefined = history?.state?.edit_client;
    if (editClient && editClient.id) {
      this.id = editClient.id;
      const full = [editClient.nombre, editClient.apellido].filter(Boolean).join(' ');
      const raw = editClient as unknown as Record<string, unknown>;
      const existingCedula = String(editClient.cedula || editClient.rifCedula || raw['cedula'] || raw['rif_cedula'] || raw['rif'] || '');
      const parsed = this.parseCedula(existingCedula);

      this.form.patchValue({
        nombreRazonSocial: full,
        nacionalidad: parsed.nac,
        nroDocumento: parsed.num,
        categoria: editClient.categoria || raw['categoria'] || '',
        email: editClient.email || '',
        telefono: editClient.telefono || '',
        direccion: editClient.direccion || ''
      });
    }
  }

  initForm() {
    this.form = this.fb.group({
      nombreRazonSocial: ['', Validators.required],
      nacionalidad: ['V', Validators.required],
      nroDocumento: [''],
      categoria: [''],
      email: ['', [Validators.email]],
      telefono: [''],
      direccion: ['']
    });
  }

  get f() {
    return this.form.controls;
  }

  volver() {
    this.router.navigate(['/clients']);
  }

  save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      Swal.fire('Atención', 'Complete los campos obligatorios.', 'warning');
      return;
    }

    this.loading = true;

    const fullName = String(this.form.get('nombreRazonSocial')?.value || '').trim();
    const parts = fullName.split(' ');
    const firstWord = parts[0] || fullName;
    const remainingWords = parts.slice(1).join(' ');

    const nac = this.form.get('nacionalidad')?.value || 'V';
    const num = String(this.form.get('nroDocumento')?.value || '').trim();
    const fullCedula = num ? `${nac}-${num}` : '';

    const clientData: Record<string, unknown> = {
      id: this.id > 0 ? this.id : undefined,
      nombre: firstWord,
      apellido: remainingWords,
      cedula: fullCedula,
      rifCedula: fullCedula,
      categoria: this.form.get('categoria')?.value || '',
      email: this.form.get('email')?.value || '',
      telefono: this.form.get('telefono')?.value || '',
      direccion: this.form.get('direccion')?.value || ''
    };

    const req$ = this.id > 0 
      ? this.clientService.updateClient(this.id, clientData as unknown as Client)
      : this.clientService.createClient(clientData as unknown as Client);

    req$.subscribe({
      next: () => {
        this.loading = false;
        const msg = this.id > 0 ? 'Cliente actualizado con éxito.' : 'Cliente registrado con éxito.';
        Swal.fire('¡Éxito!', msg, 'success').then(() => {
          this.volver();
        });
      },
      error: (err) => {
        console.error('Error saving client', err);
        this.loading = false;
        Swal.fire('Error', 'Ocurrió un error al guardar el cliente.', 'error');
      }
    });
  }
}
