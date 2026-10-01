import { Component, inject, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CarritoService, ItemCarrito } from '../../services/carrito.service';

@Component({
  selector: 'client-carrito-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './carrito-drawer.component.html',
  styleUrl: './carrito-drawer.component.scss',
})
export class CarritoDrawerComponent {
  readonly carritoService = inject(CarritoService);
  private readonly router = inject(Router);

  // Inputs y Outputs reactivos (Angular 19 Signals)
  isOpen = input.required<boolean>();
  mesaNumero = input<string>('M01');
  close = output<void>();

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const mesa = this.mesaNumero() || localStorage.getItem('tukuypaj_mesa_asignada') || 'M01';
        this.carritoService.consultarPedidoActivoMesa(mesa).subscribe();
      }
    });
  }

  cerrarDrawer(): void {
    this.close.emit();
  }

  cambiarCantidad(platoId: string, varianteId: string | undefined, cantidad: number): void {
    this.carritoService.actualizarCantidad(platoId, varianteId, cantidad);
  }

  actualizarNotas(platoId: string, varianteId: string | undefined, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.carritoService.actualizarNotas(platoId, varianteId, target.value);
  }

  enviarPedido(): void {
    const mesa = this.mesaNumero() || 'M01';
    this.carritoService.enviarPedido(mesa).subscribe({
      next: () => {
        console.log('Pedido enviado con éxito a la mesa:', mesa);
      },
      error: (err) => {
        console.error('Error al enviar el pedido:', err);
      },
    });
  }

  seguirNavegando(): void {
    this.carritoService.limpiarCarrito();
    this.close.emit();
  }

  anadirAlgoMas(): void {
    this.carritoService.pedidoConfirmado.set(false);
    this.close.emit();
  }

  llamarMesero(): void {
    const mesa = this.mesaNumero() || 'M01';
    this.carritoService.llamarMesero(mesa, 'Atención presencial en mesa solicitada').subscribe({
      next: () => console.log('Garzón llamado con éxito desde mesa', mesa),
      error: (e) => console.error('Error llamando al garzón:', e),
    });
  }

  solicitarAtencionPresencial(): void {
    this.llamarMesero();
  }

  pedirCuenta(): void {
    const mesa = this.mesaNumero() || 'M01';
    this.carritoService.solicitarCuenta(mesa).subscribe({
      next: () => console.log('Cuenta solicitada desde carrito para mesa', mesa),
    });
    this.close.emit();
    this.router.navigate(['/cierre-cuenta'], {
      queryParams: { mesa },
    });
  }

  trackByPlatoId(index: number, item: ItemCarrito): string {
    return `${item.platoId}-${item.varianteId || ''}`;
  }
}

