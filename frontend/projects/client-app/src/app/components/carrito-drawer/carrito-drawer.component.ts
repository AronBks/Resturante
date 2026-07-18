import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CarritoService, ItemCarrito } from '../../services/carrito.service';

@Component({
  selector: 'client-carrito-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carrito-drawer.component.html',
  styleUrl: './carrito-drawer.component.scss',
})
export class CarritoDrawerComponent {
  readonly carritoService = inject(CarritoService);

  // Inputs y Outputs reactivos (Angular 19 Signals)
  isOpen = input.required<boolean>();
  mesaNumero = input<string>('M01');
  close = output<void>();

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

  trackByPlatoId(index: number, item: ItemCarrito): string {
    return `${item.platoId}-${item.varianteId || ''}`;
  }
}
