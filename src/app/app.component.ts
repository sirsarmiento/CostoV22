// angular import
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgSelectConfig } from '@ng-select/ng-select';

// project import
import { SpinnerComponent } from './theme/shared/components/spinner/spinner.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet, SpinnerComponent]
})
export class AppComponent {
  title = 'COST';
  private ngSelectConfig = inject(NgSelectConfig);

  constructor() {
    this.ngSelectConfig.appendTo = 'body';
  }
}
