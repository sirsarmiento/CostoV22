import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Budget } from '../../models/Cost/budge';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/presupuestos`;

  private getMockBudgets(): Budget[] {
    const stored = localStorage.getItem('cost_budgets');
    if (stored) {
      return JSON.parse(stored);
    }
    const initial = environment.mockData.budgets as Budget[];
    localStorage.setItem('cost_budgets', JSON.stringify(initial));
    return initial;
  }

  getBudgets(): Observable<Budget[]> {
    if (environment.useMocks) {
      return of(this.getMockBudgets());
    }
    return this.http.get<{ data?: Budget[] } | Budget[]>(this.url).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  createBudget(budget: Budget): Observable<Budget> {
    if (environment.useMocks) {
      const budgets = this.getMockBudgets();
      const newId = budgets.length > 0 ? Math.max(...budgets.map(b => b.id || 0)) + 1 : 1;
      const newBudget = { ...budget, id: newId };
      budgets.push(newBudget);
      localStorage.setItem('cost_budgets', JSON.stringify(budgets));
      return of(newBudget);
    }
    const payload: Partial<Budget> = { ...budget };
    delete payload.id;
    return this.http.post<Budget>(`${environment.apiUrl}/presupuesto`, payload);
  }

  updateBudget(id: number, budget: Budget): Observable<Budget> {
    if (environment.useMocks) {
      const budgets = this.getMockBudgets();
      const index = budgets.findIndex(b => b.id === id);
      if (index !== -1) {
        budgets[index] = { ...budget, id };
        localStorage.setItem('cost_budgets', JSON.stringify(budgets));
        return of(budgets[index]);
      }
      return of(budget);
    }
    const payload: Partial<Budget> = { ...budget };
    delete payload.id;
    return this.http.put<Budget>(`${environment.apiUrl}/presupuesto/${id}`, payload);
  }

  deleteBudget(id: number): Observable<void> {
    if (environment.useMocks) {
      let budgets = this.getMockBudgets();
      budgets = budgets.filter(b => b.id !== id);
      localStorage.setItem('cost_budgets', JSON.stringify(budgets));
      return of(undefined);
    }
    return this.http.delete<void>(`${environment.apiUrl}/presupuesto/${id}`);
  }
}
