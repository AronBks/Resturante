// ============================================================
// IaComandaComponent — Chat Interactivo de Pedidos por IA
//
// Diseño: "Warm Light Elegance" mobile-first
// Flujo: Texto natural → IA interpreta → Vista previa → Confirmar
// ============================================================

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IaComandaService, ItemInterpretado } from '../../services/ia-comanda.service';

interface ChatMessage {
  tipo: 'usuario' | 'asistente' | 'sistema';
  texto: string;
  timestamp: Date;
  items?: ItemInterpretado[];
  totalEstimado?: number;
  motor?: string;
}

@Component({
  selector: 'client-ia-comanda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ia-comanda.component.html',
  styleUrl: './ia-comanda.component.scss',
})
export class IaComandaComponent implements OnInit, AfterViewChecked {
  private route = inject(ActivatedRoute);
  iaService = inject(IaComandaService);

  @ViewChild('chatContainer') chatContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;

  mesaNumero = signal('');
  inputTexto = signal('');
  mensajes = signal<ChatMessage[]>([]);
  shouldScroll = false;

  sugerenciasRapidas = [
    '🥩 Un Pique Macho',
    '🍳 Silpancho con huevo',
    '🍗 Chanka de Pollo',
    '🍖 Parrillada para dos',
    '🍹 Dos limonadas',
    '🍺 Una chicha cochabambina',
  ];

  // Computed: ¿Hay items para confirmar?
  hayItemsPendientes = computed(() => {
    const res = this.iaService.resultado();
    return res !== null && res.items.length > 0 && !this.iaService.pedidoConfirmado();
  });

  getFoodEmoji(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('pique')) return '🥩';
    if (n.includes('silpancho')) return '🍳';
    if (n.includes('chicharr')) return '🐖';
    if (n.includes('chanka') || n.includes('pollo')) return '🍗';
    if (n.includes('parrillada') || n.includes('lomo')) return '🍖';
    if (n.includes('anticucho')) return '🍢';
    if (n.includes('ranga')) return '🍲';
    if (n.includes('sopa') || n.includes('mani')) return '🥣';
    if (n.includes('chicha')) return '🍺';
    if (n.includes('limonada') || n.includes('refresco')) return '🍹';
    if (n.includes('helado')) return '🍨';
    if (n.includes('bunuelo') || n.includes('buñuelo')) return '🍩';
    if (n.includes('tranca')) return '🌯';
    return '🍽️';
  }

  ngOnInit() {
    // Obtener mesa de la URL: /pedido-ia?mesa=M03
    this.route.queryParams.subscribe((params) => {
      const mesa = params['mesa'] || 'M01';
      this.mesaNumero.set(mesa);
    });

    // Mensaje de bienvenida del asistente
    this.mensajes.set([
      {
        tipo: 'asistente',
        texto: `¡Hola! 👋 Soy el asistente virtual de **Peña Tukuypaj**. Estoy aquí para ayudarte a armar tu pedido.\n\nDime qué te gustaría comer, por ejemplo:\n_"Quiero un Pique Macho sin locoto y dos limonadas"_`,
        timestamp: new Date(),
      },
    ]);
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  enviarMensaje(texto?: string) {
    const msg = texto || this.inputTexto().trim();
    if (!msg) return;

    // Agregar mensaje del usuario
    this.mensajes.update((list) => [
      ...list,
      { tipo: 'usuario', texto: msg, timestamp: new Date() },
    ]);
    this.inputTexto.set('');
    this.shouldScroll = true;

    // Agregar indicador de "escribiendo..."
    this.mensajes.update((list) => [
      ...list,
      { tipo: 'sistema', texto: 'thinking', timestamp: new Date() },
    ]);

    // Llamar al backend
    this.iaService.interpretarPedido(msg, this.mesaNumero());

    // Esperar resultado reactivamente
    const checkResult = setInterval(() => {
      if (!this.iaService.loading()) {
        clearInterval(checkResult);

        // Remover "escribiendo..."
        this.mensajes.update((list) =>
          list.filter((m) => !(m.tipo === 'sistema' && m.texto === 'thinking')),
        );

        const resultado = this.iaService.resultado();
        const error = this.iaService.error();

        if (error) {
          this.mensajes.update((list) => [
            ...list,
            { tipo: 'asistente', texto: error, timestamp: new Date() },
          ]);
        } else if (resultado) {
          this.mensajes.update((list) => [
            ...list,
            {
              tipo: 'asistente',
              texto: resultado.mensajeIA,
              timestamp: new Date(),
              items: resultado.items,
              totalEstimado: resultado.totalEstimado,
              motor: resultado.motor,
            },
          ]);
        }

        this.shouldScroll = true;
      }
    }, 200);
  }

  usarSugerencia(sugerencia: string) {
    // Limpiar emoji del inicio
    const texto = sugerencia.replace(/^[\p{Emoji}\s]+/u, '').trim();
    this.enviarMensaje(texto);
  }

  confirmarPedido() {
    const resultado = this.iaService.resultado();
    if (!resultado || resultado.items.length === 0) return;

    this.iaService.confirmarPedido(
      this.mesaNumero(),
      resultado.items.map((i) => ({
        platoId: i.platoId,
        varianteId: i.varianteId || undefined,
        cantidad: i.cantidad,
        notas: i.notas || undefined,
      })),
    );

    // Esperar confirmación
    const check = setInterval(() => {
      if (!this.iaService.confirmando()) {
        clearInterval(check);

        if (this.iaService.pedidoConfirmado()) {
          this.mensajes.update((list) => [
            ...list,
            {
              tipo: 'asistente',
              texto: `✅ **¡Pedido confirmado!** Tu comanda ha sido enviada directamente a cocina.\n\nNuestro equipo se encargará de preparar todo. ¡Buen provecho! 🍽️`,
              timestamp: new Date(),
            },
          ]);
        } else if (this.iaService.error()) {
          this.mensajes.update((list) => [
            ...list,
            {
              tipo: 'asistente',
              texto: this.iaService.error()!,
              timestamp: new Date(),
            },
          ]);
        }
        this.shouldScroll = true;
      }
    }, 200);
  }

  nuevoPedido() {
    this.iaService.reset();
    this.mensajes.update((list) => [
      ...list,
      {
        tipo: 'asistente',
        texto: '¡Perfecto! ¿Qué más te gustaría agregar a tu mesa? 😊',
        timestamp: new Date(),
      },
    ]);
    this.shouldScroll = true;
    // Focus en input
    setTimeout(() => this.inputRef?.nativeElement?.focus(), 100);
  }

  seleccionarVarianteIA(msg: ChatMessage, item: ItemInterpretado, v: any) {
    item.varianteId = v.id;
    item.precioUnitario = v.precio;
    item.nombre = `${item.nombre.split('(')[0].trim()} (${v.nombre})`;
    
    // Recalcular total
    msg.totalEstimado = msg.items?.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0);

    // Sincronizar con el service signal
    this.iaService.resultado.update(res => {
      if (!res) return null;
      return {
        ...res,
        items: res.items.map(i => i.platoId === item.platoId ? {
          ...i,
          varianteId: v.id,
          nombre: item.nombre,
          precioUnitario: v.precio
        } : i),
        totalEstimado: msg.totalEstimado || 0
      };
    });
  }

  cambiarCantidadIA(msg: ChatMessage, item: ItemInterpretado, diff: number) {
    const newQty = item.cantidad + diff;
    if (newQty < 0) return;

    item.cantidad = newQty;

    if (newQty === 0) {
      msg.items = msg.items?.filter(i => !(i.platoId === item.platoId && i.varianteId === item.varianteId));
    }

    // Recalcular total
    msg.totalEstimado = msg.items?.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0);

    // Sincronizar con el service signal
    this.iaService.resultado.update(res => {
      if (!res) return null;
      const newItems = res.items.map(i => (i.platoId === item.platoId && i.varianteId === item.varianteId) ? {
        ...i,
        cantidad: newQty
      } : i).filter(i => i.cantidad > 0);

      return {
        ...res,
        items: newItems,
        totalEstimado: msg.totalEstimado || 0
      };
    });
  }

  private scrollToBottom() {
    try {
      const el = this.chatContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch (_) {}
  }

  trackByIndex(index: number): number {
    return index;
  }
}
