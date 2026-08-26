import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ClientService } from '../../../../../core/services/cost/client.service';
import { Client } from '../../../../../core/models/Cost/client';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-client',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
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

  constructor() {
    this.initForm();
  }

  ngOnInit(): void {
    const editClient: Client | undefined = history?.state?.edit_client;
    if (editClient && editClient.id) {
      this.id = editClient.id;
      const full = [editClient.nombre, editClient.apellido].filter(Boolean).join(' ');
      const raw = editClient as unknown as Record<string, unknown>;
      this.form.patchValue({
        nombreRazonSocial: full,
        rifCedula: editClient.rifCedula || raw['rif'] || raw['cedula'] || '',
        categoria: editClient.categoria || raw['categoria'] || 'General',
        email: editClient.email || '',
        telefono: editClient.telefono || '',
        direccion: editClient.direccion || ''
      });
    }
  }

  initForm() {
    this.form = this.fb.group({
      nombreRazonSocial: ['', Validators.required],
      rifCedula: [''],
      categoria: ['General'],
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
    if (this.form.invalid) {
      Swal.fire('Atención', 'Complete los campos obligatorios.', 'warning');
      return;
    }

    this.loading = true;

    const fullName = String(this.form.get('nombreRazonSocial')?.value || '').trim();
    const parts = fullName.split(' ');
    const firstWord = parts[0] || fullName;
    const remainingWords = parts.slice(1).join(' ');

    const clientData: Client = {
      id: this.id > 0 ? this.id : undefined,
      nombre: firstWord,
      apellido: remainingWords,
      rifCedula: this.form.get('rifCedula')?.value || '',
      categoria: this.form.get('categoria')?.value || 'General',
      email: this.form.get('email')?.value || '',
      telefono: this.form.get('telefono')?.value || '',
      direccion: this.form.get('direccion')?.value || ''
    };

    const req$ = this.id > 0 
      ? this.clientService.updateClient(this.id, clientData)
      : this.clientService.createClient(clientData);

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
