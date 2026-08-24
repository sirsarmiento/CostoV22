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
      this.form.patchValue({
        nombre: editClient.nombre,
        apellido: editClient.apellido,
        email: editClient.email || '',
        telefono: editClient.telefono || '',
        direccion: editClient.direccion || ''
      });
    }
  }

  initForm() {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
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
    const clientData: Client = {
      id: this.id > 0 ? this.id : undefined,
      ...this.form.value
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
