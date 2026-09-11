import { Component, OnDestroy, ViewEncapsulation, inject, input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import Swal from 'sweetalert2';

// project import
import { Spinkit } from './spinkits';

@Component({
  selector: 'app-spinner',
  templateUrl: './spinner.component.html',
  styleUrls: ['./spinner.component.scss', './spinkit-css/sk-line-material.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class SpinnerComponent implements OnDestroy {
  private router = inject(Router);
  private document = inject<Document>(DOCUMENT);
  private cdr = inject(ChangeDetectorRef);
  private timeoutId?: ReturnType<typeof setTimeout>;

  // public props
  isSpinnerVisible = false;
  Spinkit = Spinkit;
  backgroundColor = input('#1890ff');
  spinner = input(Spinkit.skLine);

  // Constructor
  constructor() {
    this.router.events.subscribe(
      (event) => {
        if (event instanceof NavigationStart) {
          clearTimeout(this.timeoutId);
          // Esperamos 200ms para no mostrar el spinner en transiciones instantáneas ni mientras un diálogo de confirmación está en pantalla
          this.timeoutId = setTimeout(() => {
            if (!Swal.isVisible()) {
              this.isSpinnerVisible = true;
              this.cdr.markForCheck();
            }
          }, 200);
        } else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
          clearTimeout(this.timeoutId);
          this.isSpinnerVisible = false;
          this.cdr.markForCheck();
        }
      },
      () => {
        clearTimeout(this.timeoutId);
        this.isSpinnerVisible = false;
        this.cdr.markForCheck();
      }
    );
  }

  // life cycle event
  ngOnDestroy(): void {
    clearTimeout(this.timeoutId);
    this.isSpinnerVisible = false;
  }
}
