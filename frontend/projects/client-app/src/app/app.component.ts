import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'client-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <main class="client-shell">
      <router-outlet />
    </main>
  `,
  styles: [`
    .client-shell {
      min-height: 100vh;
      min-height: 100dvh;
    }
  `],
})
export class AppComponent {}
