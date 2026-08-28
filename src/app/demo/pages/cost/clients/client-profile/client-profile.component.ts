import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ClientService } from '../../../../../core/services/cost/client.service';
import { BudgetService } from '../../../../../core/services/cost/budget.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
import { Client } from '../../../../../core/models/Cost/client';
import { calculateBudgetTotals, normalizeBudget } from '../../../../../core/utils/budget-calculator';
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
  private assetService = inject(AssetService);
  private configService = inject(ConfigService);
  private fixeService = inject(FixeService);
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
    forkJoin({
      budgets: this.budgetService.getBudgets(),
      assets: this.assetService.getAssets(),
      configs: this.configService.getConfigs(),
      fixes: this.fixeService.getFixes()
    }).subscribe({
      next: ({ budgets, assets, configs, fixes }) => {
        let capacidadHorasMaquina = 160;
        let totalFijoIndirecto = 0;

        const configObj = (configs || [])[0];
        if (configObj && configObj.parametros && Array.isArray(configObj.parametros)) {
          let capacidad = 0;
          configObj.parametros.forEach((machine) => {
            const unidad = machine.unidad?.toLowerCase().trim() || '';
            if (unidad.includes('hora') || unidad.includes('hs') || unidad === '') {
              capacidad += (Number(machine.horasUso) || 0) * (Number(machine.prodMaxHoras) || 0);
            }
          });
          capacidadHorasMaquina = capacidad > 0 ? capacidad : 160;
        }

        if (fixes && fixes.length > 0) {
          const indirectos = fixes.filter(item => item.clasificacion === 'Indirecto');
          totalFijoIndirecto = indirectos.reduce((total, item) => total + (Number(item.precio) || 0), 0);
        }

        const clientBudgets = (budgets || []).filter(b => 
          b.cliente == this.clientId || ((b as unknown as Record<string, unknown>)['cliente_id']) == this.clientId
        );

        this.history = clientBudgets.map(b => {
          const bRec = b as unknown as Record<string, unknown>;
          const storedTotal = Number(bRec['total']);
          
          const norm = normalizeBudget(b);
          const res = calculateBudgetTotals(
            norm,
            assets || [],
            totalFijoIndirecto,
            capacidadHorasMaquina
          );

          const finalMonto = (storedTotal && storedTotal > 0) ? storedTotal : res.costoTotalFinal;

          const rawNum = String(b.numero ?? '').trim().toLowerCase();
          const isProd = b.clasificacion === 'Producto';
          const isZeroOrX = rawNum === '0' || rawNum === 'x' || (b.numero as unknown) === 0;
          const isAutoNum = rawNum.startsWith('ord-pro-');
          const displayNum = (isProd || isZeroOrX || isAutoNum || !rawNum || rawNum === 'null') ? '-' : (b.numero || '-');

          return {
            id: b.id || 0,
            numero: displayNum,
            fecha: b.fecha || new Date(),
            descripcion: b.descripcion || 'Sin descripción',
            monto: finalMonto,
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
