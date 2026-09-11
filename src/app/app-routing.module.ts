// angular import
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Project import
import { AdminLayout } from './theme/layouts/admin-layout/admin-layout.component';
import { GuestLayoutComponent } from './theme/layouts/guest-layout/guest-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { pendingChangesGuard } from './core/guards/pending-changes.guard';

const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: '/login',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        redirectTo: 'dashboard/default',
        pathMatch: 'full'
      },
      {
        path: 'dashboard/default',
        loadComponent: () => import('./demo/dashboard/default/default.component').then((c) => c.DefaultComponent)
      },
      {
        path: 'typography',
        loadComponent: () => import('./demo/component/basic-component/typography/typography.component').then((c) => c.TypographyComponent)
      },
      {
        path: 'color',
        loadComponent: () => import('./demo/component/basic-component/color/color.component').then((c) => c.ColorComponent)
      },
      {
        path: 'sample-page',
        loadComponent: () => import('./demo/others/sample-page/sample-page.component').then((c) => c.SamplePageComponent)
      },
      // Cost Modules
      {
        path: 'configs',
        loadComponent: () => import('./demo/pages/cost/configs/config/config.component').then((c) => c.ConfigComponent)
      },
      {
        path: 'configs/add-config',
        loadComponent: () => import('./demo/pages/cost/configs/add-config/add-config.component').then((c) => c.AddConfigComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'products',
        loadComponent: () => import('./demo/pages/cost/products/product/product.component').then((c) => c.ProductComponent)
      },
      {
        path: 'products/add-product',
        loadComponent: () => import('./demo/pages/cost/products/add-product/add-product.component').then((c) => c.AddProductComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'codings',
        loadComponent: () => import('./demo/pages/cost/codings/coding/coding.component').then((c) => c.CodingComponent)
      },
      {
        path: 'codings/add-coding',
        loadComponent: () => import('./demo/pages/cost/codings/add-coding/add-coding.component').then((c) => c.AddCodingComponent),
        canDeactivate: [pendingChangesGuard]
      },
      // Security Modules
      {
        path: 'roles',
        loadComponent: () => import('./demo/pages/roles/role/role.component').then((c) => c.RoleComponent)
      },
      {
        path: 'roles/add-role',
        loadComponent: () => import('./demo/pages/roles/add-role/add-role.component').then((c) => c.AddRoleComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'users',
        loadComponent: () => import('./demo/pages/users/user/user.component').then((c) => c.UserComponent)
      },
      {
        path: 'users/add-user',
        loadComponent: () => import('./demo/pages/users/add-user/add-user.component').then((c) => c.AddUserComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'codings/add-family',
        loadComponent: () => import('./demo/pages/cost/codings/add-family/add-family.component').then((c) => c.AddFamilyComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'fixes',
        loadComponent: () => import('./demo/pages/cost/fixes/fixe/fixe.component').then((c) => c.FixeComponent)
      },
      {
        path: 'fixes/add-fixe',
        loadComponent: () => import('./demo/pages/cost/fixes/add-fixe/add-fixe.component').then((c) => c.AddFixeComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'assets',
        loadComponent: () => import('./demo/pages/cost/assets/asset/asset.component').then((c) => c.AssetComponent)
      },
      {
        path: 'assets/add-asset',
        loadComponent: () => import('./demo/pages/cost/assets/add-asset/add-asset.component').then((c) => c.AddAssetComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'pricings',
        loadComponent: () => import('./demo/pages/cost/pricings/pricing/pricing.component').then((c) => c.PricingComponent)
      },
      {
        path: 'budgets',
        loadComponent: () => import('./demo/pages/cost/budgets/budget/budget.component').then((c) => c.BudgetComponent)
      },
      {
        path: 'budgets/add-budget',
        loadComponent: () => import('./demo/pages/cost/budgets/add-budget/add-budget.component').then((c) => c.AddBudgetComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'clients',
        loadComponent: () => import('./demo/pages/cost/clients/clients-list/clients-list.component').then((c) => c.ClientsListComponent)
      },
      {
        path: 'clients/add-client',
        loadComponent: () => import('./demo/pages/cost/clients/add-client/add-client.component').then((c) => c.AddClientComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'clients/profile/:id',
        loadComponent: () => import('./demo/pages/cost/clients/client-profile/client-profile.component').then((c) => c.ClientProfileComponent)
      },
      {
        path: 'suppliers',
        loadComponent: () => import('./demo/pages/cost/suppliers/supplier-list/supplier-list.component').then((c) => c.SupplierListComponent)
      },
      {
        path: 'suppliers/add',
        loadComponent: () => import('./demo/pages/cost/suppliers/add-supplier/add-supplier.component').then((c) => c.AddSupplierComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'purchases',
        loadComponent: () => import('./demo/pages/cost/purchases/purchase-list/purchase-list.component').then((c) => c.PurchaseListComponent)
      },
      {
        path: 'purchases/add',
        loadComponent: () => import('./demo/pages/cost/purchases/add-purchase/add-purchase.component').then((c) => c.AddPurchaseComponent),
        canDeactivate: [pendingChangesGuard]
      },
      {
        path: 'sales',
        loadComponent: () => import('./demo/pages/cost/sales/sale-list/sale-list.component').then((c) => c.SaleListComponent)
      },
      {
        path: 'stock',
        loadComponent: () => import('./demo/pages/cost/stock/stock-list/stock-list.component').then((c) => c.StockListComponent)
      },
      {
        path: 'password/change-pass',
        loadComponent: () => import('./demo/pages/password/change-pass/change-pass.component').then((c) => c.ChangePassComponent),
        canDeactivate: [pendingChangesGuard]
      }
    ]
  },
  {
    path: '',
    component: GuestLayoutComponent,
    children: [
      {
        path: 'login',
        loadComponent: () => import('./demo/pages/authentication/auth-login/auth-login.component').then((c) => c.AuthLoginComponent)
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./demo/pages/authentication/auth-register/auth-register.component').then((c) => c.AuthRegisterComponent)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
