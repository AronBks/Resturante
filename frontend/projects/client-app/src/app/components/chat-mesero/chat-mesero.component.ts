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
import { IaComandaService, ItemInterpretado, MensajeHistorial } from '../../services/ia-comanda.service';

interface ChatBubble {
  id: string;
  rol: 'usuario' | 'asistente' | 'sistema';
  texto: string;
  timestamp: Date;
}

@Component({
  selector: 'client-chat-mesero',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat-mesero.component.html',
  styleUrl: './chat-mesero.component.scss',
})
export class ChatMeseroComponent implements OnInit, AfterViewChecked {
  private route = inject(ActivatedRoute);
  iaService = inject(IaComandaService);

  @ViewChild('chatContainer') chatContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;

  mesaNumero = signal<string>('M01');
  inputTexto = signal<string>('');
  mensajes = signal<ChatBubble[]>([]);
  showMiniTicketMobile = signal<boolean>(false);
  shouldScroll = false;

  sugerenciasRapidas = [
    '👋 ¡Hola Don Beto! ¿Qué nos recomienda hoy?',
    '🥩 Quisiera un Pique Macho Mediano',
    '🍳 Tráeme un Silpancho especial',
    '🍹 Una jarrita de limonada de 2L',
    '🍺 Una chicha cochabambina helada',
    '✅ Eso es todo, por favor enviar a cocina',
  ];

  // Computed signals
  comandaActual = computed(() => this.iaService.comandaActual());
  totalEstimado = computed(() => this.iaService.totalEstimado());
  estadoConversacion = computed(() => this.iaService.estadoConversacion());
  pedidoConfirmado = computed(() => this.iaService.pedidoConfirmado());
  confirmando = computed(() => this.iaService.confirmando());

  mostrarTarjetaFinal = computed(() => {
    return (
      (this.estadoConversacion() === 'CONFIRMACION_FINAL' || this.pedidoConfirmado()) &&
      this.comandaActual().length > 0
    );
  });

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const mesa = params['mesa'] || 'M01';
      this.mesaNumero.set(mesa);
    });

    // Saludo inicial de Don Beto
    this.mensajes.set([
      {
        id: '1',
        rol: 'asistente',
        texto: `¡Buenas tardes y sea muy bienvenido a **Peña Restaurant Tukuypaj**, casero! 🌾\n\nSoy **Don Beto**, su mesero de confianza. Estoy a su servicio para anotarle lo que más le apetezca de nuestra tradicional carta cochabambina.\n\n¿Le provendría un sabroso **Pique Macho**, un **Chicharrón** bien crocante o prefiere ver alguna recomendación?`,
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

  enviarMensaje(textoCustom?: string) {
    const msg = textoCustom || this.inputTexto().trim();
    if (!msg || this.iaService.loading()) return;

    // Agregar mensaje del usuario a la vista
    const userMsg: ChatBubble = {
      id: String(Date.now()),
      rol: 'usuario',
      texto: msg,
      timestamp: new Date(),
    };

    this.mensajes.update((list) => [...list, userMsg]);
    this.inputTexto.set('');
    this.shouldScroll = true;

    // Construir historial para Gemini
    const historial: MensajeHistorial[] = this.mensajes()
      .filter((m) => m.rol === 'usuario' || m.rol === 'asistente')
      .map((m) => ({
        rol: m.rol === 'usuario' ? 'usuario' : 'asistente',
        texto: m.texto,
      }));

    // Indicador de escritura "Don Beto está anotando..."
    this.mensajes.update((list) => [
      ...list,
      {
        id: 'thinking',
        rol: 'sistema',
        texto: 'Don Beto está anotando...',
        timestamp: new Date(),
      },
    ]);

    // Enviar solicitud a la IA
    this.iaService.interpretarPedido(msg, this.mesaNumero(), historial);

    // Polling reactivo corto para recibir respuesta
    const interval = setInterval(() => {
      if (!this.iaService.loading()) {
        clearInterval(interval);

        // Quitar indicador de escritura
        this.mensajes.update((list) => list.filter((m) => m.id !== 'thinking'));

        const res = this.iaService.resultado();
        const err = this.iaService.error();

        if (err) {
          this.mensajes.update((list) => [
            ...list,
            {
              id: String(Date.now()),
              rol: 'asistente',
              texto: err,
              timestamp: new Date(),
            },
          ]);
        } else if (res) {
          this.mensajes.update((list) => [
            ...list,
            {
              id: String(Date.now()),
              rol: 'asistente',
              texto: res.respuestaMesero,
              timestamp: new Date(),
            },
          ]);
        }

        this.shouldScroll = true;
      }
    }, 150);
  }

  usarSugerencia(sugerencia: string) {
    const textoLimpio = sugerencia.replace(/^[\p{Emoji}\s]+/u, '').trim();
    this.enviarMensaje(textoLimpio);
  }

  modificarCantidad(item: ItemInterpretado, delta: number) {
    this.iaService.actualizarCantidad(item.platoId, item.varianteId, delta);
  }

  eliminarItem(item: ItemInterpretado) {
    this.iaService.eliminarItem(item.platoId, item.varianteId);
  }

  confirmarComandaFinal() {
    this.iaService.confirmarPedido(this.mesaNumero());

    const check = setInterval(() => {
      if (!this.iaService.confirmando()) {
        clearInterval(check);

        if (this.iaService.pedidoConfirmado()) {
          this.mensajes.update((list) => [
            ...list,
            {
              id: String(Date.now()),
              rol: 'asistente',
              texto: `¡Listo casero! ✅ Su pedido ha sido marchado a nuestra cocina de **Peña Tukuypaj**.\n\nEn breve nuestros garzones le servirán la mesa. ¡Que tengan muy buen provecho! 🍽️✨`,
              timestamp: new Date(),
            },
          ]);
          this.shouldScroll = true;
        }
      }
    }, 200);
  }

  toggleMiniTicketMobile() {
    this.showMiniTicketMobile.update((v) => !v);
  }

  private scrollToBottom() {
    try {
      if (this.chatContainer?.nativeElement) {
        this.chatContainer.nativeElement.scrollTop =
          this.chatContainer.nativeElement.scrollHeight;
      }
    } catch (_) {}
  }

  getFoodEmoji(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('pique')) return '🥩';
    if (n.includes('silpancho')) return '🍳';
    if (n.includes('chicharr')) return '🐖';
    if (n.includes('chanka') || n.includes('pollo')) return '🍗';
    if (n.includes('parrillada') || n.includes('lomo')) return '🍖';
    if (n.includes('anticucho')) return '🍢';
    if (n.includes('chicha')) return '🍺';
    if (n.includes('limonada') || n.includes('refresco')) return '🍹';
    if (n.includes('bunuelo') || n.includes('buñuelo')) return '🍩';
    return '🍽️';
  }
}
