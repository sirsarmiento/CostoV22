import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClientService } from '../../../../../core/services/cost/client.service';
import { BudgetService } from '../../../../../core/services/cost/budget.service';
import { Client } from '../../../../../core/models/Cost/client';
import { Budget } from '../../../../../core/models/Cost/budge';
import Swal from 'sweetalert2';

export interface BudgetHistoryItem {
  id: number;
  numero: string;
  fecha: string | Date;
  descripcion: string;
  monto: number;
  clasificacion: string;
}

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './client-profile.component.html'
})
export class ClientProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private clientService = inject(ClientService);
  private budgetService = inject(BudgetService);
  private cdr = inject(ChangeDetectorRef);

  clientId = 0;
  clientInfo: Client | null = null;
  history: BudgetHistoryItem[] = [];
  loading = true;

  get clientInitials(): string {
    if (!this.clientInfo) return 'CL';
    const n = (this.clientInfo.nombre || '').trim();
    const a = (this.clientInfo.apellido || '').trim();
    const initN = n ? n.charAt(0).toUpperCase() : '';
    const initA = a ? a.charAt(0).toUpperCase() : '';
    return (initN + initA) || 'CL';
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.clientId = +params['id'];
      if (this.clientId) {
        this.loadClientData();
        this.loadHistory();
      }
    });
  }

  loadClientData() {
    this.loading = true;
    const stateClient: Client | undefined = history.state.client;
    if (stateClient && Number(stateClient.id) === Number(this.clientId)) {
      this.clientInfo = stateClient;
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.clientService.getClientById(this.clientId).subscribe({
      next: (client) => {
        if (client) {
          this.clientInfo = client;
        } else {
          Swal.fire('Atención', 'No se encontró la información del cliente.', 'warning');
          this.volver();
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading client profile', err);
        this.loading = false;
        Swal.fire('Error', 'No se pudo cargar la información del cliente.', 'error');
      }
    });
  }

  loadHistory() {
    this.budgetService.getBudgets().subscribe({
      next: (budgets: Budget[]) => {
        const clientBudgets = (budgets || []).filter(b => 
          b.clienteId == this.clientId || ((b as unknown as Record<string, unknown>)['cliente_id']) == this.clientId
        );

        this.history = clientBudgets.map(b => {
          const costoPiezas = (b.piezas || []).reduce((acc, p) => {
            const mat = Number(p.precioMaterial || 0);
            return acc + mat;
          }, 0);
          
          const totalFinal = Number((b as unknown as Record<string, unknown>)['costoTotalFinal']) || costoPiezas;
          
          return {
            id: b.id || 0,
            numero: b.numero || `PRE-${b.id}`,
            fecha: b.fecha || new Date(),
            descripcion: b.descripcion || 'Sin descripción',
            monto: totalFinal,
            clasificacion: b.clasificacion || 'Presupuesto'
          };
        });

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading budget history for client', err);
      }
    });
  }

  editarCliente() {
    if (this.clientInfo) {
      this.router.navigate(['/clients/add-client'], { state: { edit_client: this.clientInfo } });
    }
  }

  volver() {
    this.router.navigate(['/clients']);
  }
}
