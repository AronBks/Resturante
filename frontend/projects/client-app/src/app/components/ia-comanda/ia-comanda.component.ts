// ============================================================
// IaComandaComponent — Chat Inteligente con Don Beto (n8n + POS)
// Peña Restaurant Tukuypaj — Cochabamba, Bolivia
// ============================================================

import {
  Component,
  OnInit,
  AfterViewChecked,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import {
  DonBetoService,
  MensajeChat,
  ItemComanda,
  resolverIdentificadorMesa,
  formatearMesaParaBackend,
  detectarIntencionMarchado,
} from '../../services/don-beto.service';
import {
  CartaPublicaService,
  PlatoPublico,
  VariantePublica,
  resolverImagenCloudinary,
} from '../../services/carta-publica.service';
import { CarritoService } from '../../services/carrito.service';
import { SocketPublicoService } from '../../services/socket-publico.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'client-ia-comanda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './ia-comanda.component.html',
  styleUrls: ['./ia-comanda.component.scss'],
})
export class IaComandaComponent implements OnInit, AfterViewChecked {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  donBetoService = inject(DonBetoService);
  cartaService = inject(CartaPublicaService);
  carritoService = inject(CarritoService);
  private socketPublico = inject(SocketPublicoService);

  @ViewChild('chatContainer') chatContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;

  // ── Signals de Estado ──
  mesaId = signal<string>('mesa-1');
  mesaBackend = signal<string>('M01');
  mesaDisplay = signal<string>('1');

  mensajes = signal<MensajeChat[]>([]);
  cargando = signal<boolean>(false);
  marchando = signal<boolean>(false);
  inputTexto = signal<string>('');
  toastMensaje = signal<string>('');

  // Comanda sincronizada en vivo
  comandaItems = signal<ItemComanda[]>([]);
  totalComanda = computed(() =>
    this.comandaItems().reduce(
      (sum, item) => sum + item.precioUnitario * item.cantidad,
      0,
    ),
  );

  // Pedido activo consolidado en backend (PostgreSQL)
  pedidoActivoBackend = signal<any>(null);

  totalMostrar = computed(() => {
    const p = this.pedidoActivoBackend();
    if (p && p.total !== undefined && p.total !== null && p.total > 0) {
      return Number(p.total);
    }
    return this.totalComanda();
  });

  cantidadItemsActivos = computed(() => {
    const itemsCocina = this.pedidoActivoBackend()?.items?.length || 0;
    return itemsCocina + this.comandaItems().length;
  });

  mostrarTarjetaConfirmacion = signal<boolean>(false);
  pedidoConfirmadoExitoso = signal<boolean>(false);
  codigoPedidoExitoso = signal<string>('');
  drawerComandaAbierto = signal<boolean>(false);

  // ── Drawer de la Carta Interactiva ──
  drawerCartaAbierto = signal<boolean>(false);
  platoConsultaDuda = signal<PlatoPublico | null>(null);
  categoriaCartaSeleccionada = signal<number | null>(null);
  busquedaCarta = signal<string>('');
  varianteSeleccionada = signal<Record<string, VariantePublica>>({});

  platosFiltradosCarta = computed(() => {
    const categorias = this.cartaService.categorias();
    const catId = this.categoriaCartaSeleccionada();
    const query = this.busquedaCarta().toLowerCase().trim();

    const resultado: { categoriaNombre: string; plato: PlatoPublico }[] = [];

    for (const cat of categorias) {
      if (catId !== null && cat.id !== catId) continue;
      for (const plato of cat.platos) {
        if (query) {
          const matchNombre = plato.nombre.toLowerCase().includes(query);
          const matchDesc = plato.descripcion?.toLowerCase().includes(query) || false;
          if (!matchNombre && !matchDesc) continue;
        }
        resultado.push({ categoriaNombre: cat.nombre, plato });
      }
    }
    return resultado;
  });

  private shouldScroll = false;

  ngOnInit(): void {
    // 1. Cargar el menú oficial si aún no está en memoria
    if (this.cartaService.categorias().length === 0) {
      this.cartaService.cargarCarta();
    }

    // 2. Resolver identificador de mesa
    let mesaParam = this.route.snapshot.queryParamMap.get('mesa');
    if (!mesaParam) {
      try {
        mesaParam = localStorage.getItem('tukuypaj_mesa_asignada');
      } catch (e) {
        console.warn('Error leyendo mesa de localStorage:', e);
      }
    }

    const n8nMesa = resolverIdentificadorMesa(mesaParam);
    const backendMesa = formatearMesaParaBackend(mesaParam);

    this.mesaId.set(n8nMesa);
    this.mesaBackend.set(backendMesa);

    // Número limpio para el cliente (ej: M01 -> 1, mesa-2 -> 2)
    let displayNum = mesaParam ? mesaParam.replace(/^(?:mesa[-_]?|m0*)/i, '') : '1';
    if (!displayNum || displayNum.toLowerCase().startsWith('m')) {
      displayNum = mesaParam?.replace(/\D+/g, '') || '1';
    }
    this.mesaDisplay.set(displayNum || '1');

    // Persistir mesa en localStorage para que todos los componentes (carrito, drawer, cierre) estén alineados
    try {
      localStorage.setItem('tukuypaj_mesa_asignada', backendMesa);
    } catch (e) {}

    // Sincronizar inmediatamente la comanda activa desde PostgreSQL
    this.sincronizarPedidoActivoBackend();

    // Suscribirse a WebSockets para sincronización bidireccional en tiempo real
    this.socketPublico.onEstadoPedidoActualizado().subscribe((evento) => {
      const mesaNormEvent = formatearMesaParaBackend(evento.mesaNumero);
      if (mesaNormEvent === this.mesaBackend()) {
        this.sincronizarPedidoActivoBackend();
      }
    });

    this.socketPublico.onPagoConfirmado().subscribe((evento) => {
      const mesaNormEvent = formatearMesaParaBackend(evento.mesaNumero);
      if (mesaNormEvent === this.mesaBackend()) {
        this.pedidoConfirmadoExitoso.set(false);
        this.codigoPedidoExitoso.set('');
        this.pedidoActivoBackend.set(null);
        this.comandaItems.set([]);
        this.carritoService.limpiarCarrito();

        // Limpiar inmediatamente el almacenamiento en sesión para que la próxima visita esté libre
        try {
          sessionStorage.removeItem(this.getStorageKey());
        } catch (e) {}

        const nroRecibo = evento.transaccion?.nroRecibo || 'Recibo Oficial';
        const totalPagado = evento.transaccion?.total || this.totalMostrar();

        const msgPago: MensajeChat = {
          id: `pago-${Date.now()}`,
          emisor: 'don-beto',
          texto: `¡Muchas gracias por su visita! Su cuenta (Mesa ${this.mesaDisplay()}) ha sido cancelada con éxito en caja (**${nroRecibo}** por Bs. ${Number(totalPagado).toFixed(2)}).\n\n¡Esperamos que hayan disfrutado mucho de nuestra tradición gastronómica! Puede revisar y descargar su recibo oficial o volver a la carta cuando guste.`,
          timestamp: new Date(),
        };

        this.mensajes.update((lista) => [...lista, msgPago]);
        this.shouldScroll = true;
      }
    });

    // 3. Restaurar sesión previa si existe (para no perder el chat si navega o recarga durante una orden activa)
    const sesionRestaurada = this.recuperarDeSesion();
    if (!sesionRestaurada) {
      this.reiniciarChatParaNuevoComensal();
    }

    this.shouldScroll = true;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  /**
   * Sincroniza en tiempo real el pedido activo de la mesa desde PostgreSQL
   */
  sincronizarPedidoActivoBackend(): void {
    this.carritoService.consultarPedidoActivoMesa(this.mesaBackend()).subscribe({
      next: (pedidoActivo) => {
        if (pedidoActivo && pedidoActivo.id) {
          this.pedidoActivoBackend.set(pedidoActivo);
          this.pedidoConfirmadoExitoso.set(true);
          this.codigoPedidoExitoso.set(
            pedidoActivo.codigo || `CMD-${pedidoActivo.id.substring(0, 4).toUpperCase()}`
          );
        } else {
          this.pedidoActivoBackend.set(null);
          this.pedidoConfirmadoExitoso.set(false);
          this.codigoPedidoExitoso.set('');

          // Si en backend NO hay pedido activo (mesa libre o pagada en caja),
          // y en pantalla aún hay mensajes de una cuenta finalizada, reiniciar automáticamente
          const msgs = this.mensajes();
          const tieneMensajePago = msgs.some(
            (m) => m.id?.startsWith('pago-') || (m.texto && m.texto.includes('ha sido cancelada con éxito')),
          );

          if (tieneMensajePago) {
            this.reiniciarChatParaNuevoComensal();
          } else {
            this.guardarEnSesion();
          }
        }
      },
      error: (err) => {
        console.warn('Error sincronizando comanda activa:', err);
      },
    });
  }

  formatEstado(estado?: string): string {
    if (!estado) return 'En preparación';
    switch (estado.toUpperCase()) {
      case 'ABIERTO':
        return 'En espera';
      case 'EN_COCINA':
        return 'En cocina';
      case 'LISTO':
        return '¡Listo para servir!';
      case 'ENTREGADO':
        return 'Servido en mesa';
      default:
        return estado;
    }
  }

  formatEstadoItem(estadoItem?: string): string {
    if (!estadoItem) return 'Por Servir';
    switch (estadoItem.toUpperCase()) {
      case 'PENDIENTE':
        return 'Por Servir';
      case 'PREPARANDO':
        return 'En Cocina';
      case 'LISTO':
        return 'Listo';
      case 'ENTREGADO':
        return 'Servido';
      default:
        return 'Por Servir';
    }
  }

  /**
   * Envía mensaje a n8n y sincroniza la comanda del restaurante
   */
  enviarMensaje(textoCustom?: string): void {
    const texto = (textoCustom || this.inputTexto()).trim();
    if (!texto || this.cargando() || this.marchando()) return;

    // 1. Agregar mensaje del cliente a la conversación
    const msgCliente: MensajeChat = {
      id: `client-${Date.now()}`,
      emisor: 'cliente',
      texto,
      timestamp: new Date(),
    };

    this.mensajes.update((lista) => [...lista, msgCliente]);
    this.guardarEnSesion();
    this.inputTexto.set('');
    this.cargando.set(true);
    this.shouldScroll = true;

    // 2. Extraer platos detectados en el texto del cliente
    this.actualizarComandaConTexto(texto);

    // 2.1 Extraer notas de preparación o preferencias (ej: "sin chorizo", "sin locoto", "poco picante")
    this.actualizarNotasConTexto(texto);

    // Si el cliente pide explícitamente marchar o terminar
    const clientePidioMarchar = detectarIntencionMarchado(texto);

    // 2.2 Construir contexto consolidado de la mesa para n8n
    const itemsBorrador = this.comandaItems();
    const pedidoActual = this.pedidoActivoBackend();
    let resumenMesa = '';

    if (pedidoActual && pedidoActual.items && pedidoActual.items.length > 0) {
      const itemsCocinaStr = pedidoActual.items
        .map((i: any) => `${i.plato?.nombre || 'Plato'} x${i.cantidad} (Bs. ${Number(i.subtotal).toFixed(2)})`)
        .join(', ');
      resumenMesa += `Platos ya marchados en cocina: [${itemsCocinaStr}], subtotal cocina Bs. ${Number(pedidoActual.total).toFixed(2)}. `;
    }

    if (itemsBorrador.length > 0) {
      const draftStr = itemsBorrador
        .map((i) => `${i.nombre} x${i.cantidad}${i.notas ? ` (${i.notas})` : ''} (Bs. ${(i.precioUnitario * i.cantidad).toFixed(2)})`)
        .join(', ');
      const subtotalDraft = itemsBorrador.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);
      resumenMesa += `Ronda actual en borrador de comanda: [${draftStr}], subtotal ronda Bs. ${subtotalDraft.toFixed(2)}. `;
    }

    const totalConsolidado = (pedidoActual ? Number(pedidoActual.total) : 0) +
      itemsBorrador.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);

    if (resumenMesa) {
      resumenMesa += `Total acumulado actual de la mesa: Bs. ${totalConsolidado.toFixed(2)}. `;
      resumenMesa += `REGLA DE ATENCIÓN: NO ofrezcas cobrar, pagar ni cancelar en efectivo o QR mientras el cliente esté ordenando o consultando. Solo confirma los platos. Si el cliente dice que es todo o pide marchar, confirma el envío a cocina.`;
    }

    // 3. Consultar flujo n8n
    this.donBetoService.enviarMensajeN8n(texto, this.mesaId(), resumenMesa).subscribe({
      next: (resServidor: string) => {
        let respuestaLimpia = (resServidor || '').trim();

        // Si n8n responde en JSON string
        try {
          if (respuestaLimpia.startsWith('{') && respuestaLimpia.endsWith('}')) {
            const parsed = JSON.parse(respuestaLimpia);
            respuestaLimpia =
              parsed.output ||
              parsed.message ||
              parsed.response ||
              parsed.texto ||
              respuestaLimpia;
          }
        } catch (_) {}

        if (!respuestaLimpia) {
          respuestaLimpia = '¡Anotado caserito! Enseguida lo marcho con la cocina.';
        }

        // Limpiar cualquier ofrecimiento prematuro de cobro mientras el cliente aún está armando su pedido
        respuestaLimpia = respuestaLimpia
          .replace(/\s*(?:y\s+)?puede\s+cancelar\s+(?:aquí|aqui)\s+mismo\s+en\s+efectivo\s+o\s+mediante\s+(?:el\s+código\s+)?qr\s+si\s+gusta\.?/gi, '')
          .replace(/\s*(?:y\s+)?puede\s+pagar\s+(?:aquí|aqui)\s+mismo\s+en\s+efectivo\s+o\s+mediante\s+(?:el\s+código\s+)?qr\s+si\s+gusta\.?/gi, '')
          .trim();

        // 4. Analizar si Don Beto confirma platos afirmativamente (filtrando preguntas u ofertas)
        const lineas = respuestaLimpia.split('\n');
        for (const linea of lineas) {
          const l = linea.trim();
          if (!l) continue;
          const lNorm = l.toLowerCase();
          // Ignorar preguntas u ofertas comerciales (ej: "¿le gustaría una cervecita?")
          if (l.includes('?') || l.includes('¿') || lNorm.includes('gustaria') || lNorm.includes('gusta que') || lNorm.includes('prefiere')) {
            continue;
          }
          // Si confirma platos ("sale la jarra...", "anotado...", "le anoto...", "unito de...")
          if (lNorm.includes('sale ') || lNorm.includes('anotado') || lNorm.includes('le anoto') || lNorm.includes('pedido de') || lNorm.includes('unito de')) {
            this.actualizarComandaConTexto(l);
          }
        }

        // 5. Detectar si Don Beto o el cliente confirmaron marchado a la cocina
        const confirmaMarchado =
          clientePidioMarchar ||
          detectarIntencionMarchado(respuestaLimpia) ||
          respuestaLimpia.toLowerCase().includes('lo marcho con la cocina') ||
          respuestaLimpia.toLowerCase().includes('enseguida lo marcho');

        // AUTO-MARCHADO A COCINA:
        // Si Don Beto o el cliente confirman el marchado y hay productos en la ronda,
        // marchar de inmediato a cocina sin obligar al usuario a hacer clics manuales.
        if (confirmaMarchado && this.comandaItems().length > 0) {
          this.marcharPedidoACocina();
        }

        const msgDonBeto: MensajeChat = {
          id: `donbeto-${Date.now()}`,
          emisor: 'don-beto',
          texto: respuestaLimpia,
          timestamp: new Date(),
          esConfirmacion: confirmaMarchado,
        };

        this.mensajes.update((lista) => [...lista, msgDonBeto]);
        this.guardarEnSesion();
        this.cargando.set(false);
        this.shouldScroll = true;
      },
      error: (err) => {
        console.error('[Don Beto n8n] Error en flujo:', err);

        const msgError: MensajeChat = {
          id: `err-${Date.now()}`,
          emisor: 'don-beto',
          texto:
            '¡Uy caserito! Hubo un problema al conectar con la cocina. ¿Podrías repetirme tu pedido?',
          timestamp: new Date(),
        };

        this.mensajes.update((lista) => [...lista, msgError]);
        this.guardarEnSesion();
        this.cargando.set(false);
        this.shouldScroll = true;
      },
    });
  }

  /**
   * Formatea texto Markdown para eliminar asteriscos y renderizar negrita y saltos de línea de forma elegante
   */
  formatearTexto(texto: string): string {
    if (!texto) return '';
    let html = texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Negritas: **texto** o __texto__
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Cursivas: *texto*
    html = html.replace(/(^|[^\*])\*(?!\*)(.*?)\*(?!\*)/g, '$1<em>$2</em>');

    // Saltos de línea
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  /**
   * Extrae platos y bebidas de un texto y actualiza la comanda
   */
  private actualizarComandaConTexto(texto: string): void {
    const categorias = this.cartaService.categorias();
    if (categorias.length > 0) {
      const comandaActualizada = this.donBetoService.extraerItemsDeTexto(
        texto,
        categorias,
        this.comandaItems(),
      );
      this.comandaItems.set(comandaActualizada);
    }
  }

  /**
   * Extrae notas culinarias (ej: "sin chorizo", "sin locoto", "poco picante", "bien cocido") y las adjunta al plato correspondiente
   */
  private actualizarNotasConTexto(texto: string): void {
    if (!texto || this.comandaItems().length === 0) return;
    const t = texto.toLowerCase().trim();

    // Extraer instrucción concisa (ej: "sin chorizo", "sin cebolla", "sin locoto")
    let notaCulinaria: string | null = null;
    const matchSin = t.match(/\bsin\s+(?:nada\s+de\s+)?([a-zñáéíóú]+(?:\s+[a-zñáéíóú]+)?)/i);
    if (matchSin) {
      const itemSin = matchSin[1].trim();
      const excluir = ['jarra', 'entero', 'medio', 'plato', 'porfa', 'por favor', 'duda', 'consulta'];
      if (!excluir.includes(itemSin)) {
        notaCulinaria = `sin ${itemSin}`;
      }
    } else if (t.includes('sin locoto')) {
      notaCulinaria = 'sin locoto';
    } else if (t.includes('sin picante')) {
      notaCulinaria = 'sin picante';
    } else if (t.includes('con poco locoto') || t.includes('poco picante')) {
      notaCulinaria = 'poco picante';
    } else if (t.includes('harto locoto')) {
      notaCulinaria = 'con harto locoto';
    } else if (t.includes('bien cocido')) {
      notaCulinaria = 'bien cocido';
    }

    if (notaCulinaria) {
      this.comandaItems.update((items) => {
        const copia = [...items];
        // Buscar el plato objetivo al que aplica
        let idxTarget = -1;
        for (let i = copia.length - 1; i >= 0; i--) {
          const itemNorm = copia[i].nombre.toLowerCase();
          if (
            t.includes(itemNorm) ||
            (itemNorm.includes('pique') && t.includes('pique')) ||
            (itemNorm.includes('charque') && t.includes('charque')) ||
            (itemNorm.includes('pamp') && t.includes('pamp'))
          ) {
            idxTarget = i;
            break;
          }
        }
        if (idxTarget === -1) {
          for (let i = copia.length - 1; i >= 0; i--) {
            const nom = (copia[i].nombre || '').toLowerCase();
            if (!nom.includes('hervido') && !nom.includes('coca')) {
              idxTarget = i;
              break;
            }
          }
          if (idxTarget === -1) idxTarget = copia.length - 1;
        }

        if (idxTarget >= 0) {
          copia[idxTarget] = { ...copia[idxTarget], notas: notaCulinaria! };
        }
        return copia;
      });
    }
  }

  /**
   * Envía la comanda formalmente a PostgreSQL y emite WebSockets para cocina y salón
   */
  marcharPedidoACocina(): void {
    if (this.comandaItems().length === 0 || this.marchando()) return;

    this.marchando.set(true);

    this.donBetoService
      .confirmarPedidoEnCocina(this.mesaBackend(), this.comandaItems())
      .subscribe({
        next: (res) => {
          const pedido = res?.data ?? res;
          const codigo =
            pedido?.codigo ||
            (pedido?.id
              ? `CMD-${pedido.id.substring(0, 4).toUpperCase()}`
              : `CMD-${Math.floor(1000 + Math.random() * 9000)}`);

          this.marchando.set(false);
          this.mostrarTarjetaConfirmacion.set(false);
          this.pedidoConfirmadoExitoso.set(true);
          this.codigoPedidoExitoso.set(codigo);

          // Limpiar la ronda marchada para que futuros pedidos no la dupliquen
          this.comandaItems.set([]);

          // Sincronizar inmediatamente con PostgreSQL para consolidar el total real
          this.sincronizarPedidoActivoBackend();

          // Mensaje de éxito en el chat con tono formal y profesional
          const msgExito: MensajeChat = {
            id: `done-${Date.now()}`,
            emisor: 'don-beto',
            texto: `**¡Comanda marchada a la cocina!**\n\nYa anoté su comanda para la **Mesa ${this.mesaDisplay()}** (Comanda **#${codigo}**).\n\nNuestros cocineros ya están preparando todo para traérselo a la mesa. Si gusta ordenar algo más o necesita algo, solo dígamelo. ¡Buen provecho!`,
            timestamp: new Date(),
          };

          this.mensajes.update((lista) => [...lista, msgExito]);
          this.guardarEnSesion();
          this.shouldScroll = true;
        },
        error: (err) => {
          this.marchando.set(false);
          console.error('Error marchando pedido a cocina:', err);

          const errorMsg =
            err.error?.message ||
            'Hubo un problema al registrar la comanda en cocina. Por favor intente nuevamente.';

          const msgErr: MensajeChat = {
            id: `err-marchado-${Date.now()}`,
            emisor: 'don-beto',
            texto: `⚠️ **Aviso de Don Beto:** ${Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg}`,
            timestamp: new Date(),
          };

          this.mensajes.update((lista) => [...lista, msgErr]);
          this.guardarEnSesion();
          this.shouldScroll = true;
        },
      });
  }

  /**
   * Modifica la cantidad de un ítem en la comanda
   */
  modificarCantidad(item: ItemComanda, delta: number): void {
    this.comandaItems.update((items) => {
      return items
        .map((i) => {
          if (i.platoId === item.platoId && (i.varianteId || '') === (item.varianteId || '')) {
            const nuevaCant = i.cantidad + delta;
            return nuevaCant > 0 ? { ...i, cantidad: nuevaCant } : null;
          }
          return i;
        })
        .filter((i): i is ItemComanda => i !== null);
    });
    this.guardarEnSesion();
  }

  eliminarItem(item: ItemComanda): void {
    this.comandaItems.update((items) =>
      items.filter(
        (i) => !(i.platoId === item.platoId && (i.varianteId || '') === (item.varianteId || '')),
      ),
    );
    this.guardarEnSesion();
  }

  toggleDrawerComanda(): void {
    this.drawerComandaAbierto.update((v) => !v);
  }

  toggleDrawerCarta(): void {
    this.drawerCartaAbierto.update((v) => !v);
  }

  cerrarModalConfirmacion(): void {
    this.mostrarTarjetaConfirmacion.set(false);
  }

  // ── Métodos para interactuar con la Carta Digital dentro del Chat ──

  getVariantesPlato(plato: PlatoPublico): VariantePublica[] {
    if (!plato.variantes) return [];
    if (Array.isArray(plato.variantes)) return plato.variantes;
    try {
      if (typeof plato.variantes === 'string') {
        const parsed = JSON.parse(plato.variantes);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (_) {}
    return [];
  }

  seleccionarVariante(platoId: string, variante: VariantePublica, event?: Event): void {
    if (event) event.stopPropagation();
    this.varianteSeleccionada.update((map) => ({
      ...map,
      [platoId]: variante,
    }));
  }

  getVarianteActual(plato: PlatoPublico): VariantePublica | undefined {
    const vars = this.getVariantesPlato(plato);
    if (vars.length === 0) return undefined;
    return this.varianteSeleccionada()[plato.id] || vars[0];
  }

  getPrecioPlato(plato: PlatoPublico): number {
    const v = this.getVarianteActual(plato);
    if (v && v.precio) return Number(v.precio);
    return Number(plato.precioVenta) || 0;
  }

  /**
   * Obtiene la URL oficial de la imagen del plato en Cloudinary
   */
  getPlatoImageUrl(plato: any): string {
    return plato?.imagenUrl || resolverImagenCloudinary(plato?.nombre || '');
  }

  /**
   * Pide el plato seleccionado a Don Beto directamente en el chat
   */
  pedirPlatoADonBeto(plato: PlatoPublico, event?: Event): void {
    if (event) event.stopPropagation();
    const v = this.getVarianteActual(plato);
    const nombreVar = v ? ` (${v.nombre})` : '';
    const texto = `Don Beto, por favor anóteme 1x ${plato.nombre}${nombreVar}`;
    this.drawerCartaAbierto.set(false);
    this.enviarMensaje(texto);
  }

  /**
   * Llena el campo de texto con el plato para que el comensal escriba una nota especial (ej: sin locoto)
   */
  escribirNotaPlato(plato: PlatoPublico, event?: Event): void {
    if (event) event.stopPropagation();
    const v = this.getVarianteActual(plato);
    const nombreVar = v ? ` ${v.nombre}` : '';
    this.inputTexto.set(`Don Beto, quiero 1x ${plato.nombre}${nombreVar}, `);
    this.drawerCartaAbierto.set(false);
    setTimeout(() => {
      if (this.inputRef?.nativeElement) {
        this.inputRef.nativeElement.focus();
      }
    }, 200);
  }

  /**
   * Agrega el plato con 1 clic al borrador de la comanda sin necesidad de chatear
   */
  agregarDirectoAComanda(plato: PlatoPublico, event?: Event): void {
    if (event) event.stopPropagation();
    const v = this.getVarianteActual(plato);
    const nombre = v ? `${plato.nombre} (${v.nombre})` : plato.nombre;
    const precio = v ? Number(v.precio) : Number(plato.precioVenta);
    const varianteId = v?.id;

    this.comandaItems.update((items) => {
      const idx = items.findIndex(
        (i) => i.platoId === plato.id && (i.varianteId || '') === (varianteId || ''),
      );
      if (idx >= 0) {
        const copia = [...items];
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
        return copia;
      } else {
        return [
          ...items,
          {
            platoId: plato.id,
            nombre,
            cantidad: 1,
            precioUnitario: precio,
            varianteId,
          },
        ];
      }
    });

    this.guardarEnSesion();
    this.toastMensaje.set(`¡${nombre} agregado a su comanda!`);
    setTimeout(() => this.toastMensaje.set(''), 2600);
  }

  /**
   * Obtiene la cantidad que el cliente ya tiene en su comanda para este plato y variante
   */
  getCantidadEnComanda(plato: PlatoPublico): number {
    const v = this.getVarianteActual(plato);
    const varianteId = v?.id;
    const item = this.comandaItems().find(
      (i) => i.platoId === plato.id && (i.varianteId || '') === (varianteId || ''),
    );
    return item ? item.cantidad : 0;
  }

  /**
   * Modifica la cantidad directamente desde la tarjeta de la carta
   */
  cambiarCantidadDesdeCarta(plato: PlatoPublico, delta: number, event?: Event): void {
    if (event) event.stopPropagation();
    const v = this.getVarianteActual(plato);
    const varianteId = v?.id;
    const item = this.comandaItems().find(
      (i) => i.platoId === plato.id && (i.varianteId || '') === (varianteId || ''),
    );

    if (item) {
      this.modificarCantidad(item, delta);
    } else if (delta > 0) {
      this.agregarDirectoAComanda(plato, event);
    }
  }

  /**
   * Abre el modal de consultas rápidas para resolver dudas con Don Beto sobre este plato
   */
  abrirConsultarDuda(plato: PlatoPublico, event?: Event): void {
    if (event) event.stopPropagation();
    this.platoConsultaDuda.set(plato);
  }

  cerrarConsultarDuda(): void {
    this.platoConsultaDuda.set(null);
  }

  /**
   * Envía o prepara una consulta sobre el plato a Don Beto
   */
  enviarConsultaDonBeto(pregunta: string, autoejecutar = true): void {
    const plato = this.platoConsultaDuda();
    if (!plato) return;

    const v = this.getVarianteActual(plato);
    const nombreVar = v ? ` (${v.nombre})` : '';
    const textoMensaje = pregunta
      ? `Don Beto, sobre el ${plato.nombre}${nombreVar}: ${pregunta}`
      : `Don Beto, tengo una consulta sobre el ${plato.nombre}${nombreVar}: `;

    this.platoConsultaDuda.set(null);
    this.drawerCartaAbierto.set(false);

    if (autoejecutar && pregunta) {
      this.enviarMensaje(textoMensaje);
    } else {
      this.inputTexto.set(textoMensaje);
      setTimeout(() => {
        if (this.inputRef?.nativeElement) {
          this.inputRef.nativeElement.focus();
        }
      }, 200);
    }
  }

  // ── Persistencia en Sesión (evita perder conversación si el cliente sale y vuelve) ──

  private getStorageKey(): string {
    return `tukuypaj_chat_sesion_${this.mesaBackend()}`;
  }

  guardarEnSesion(): void {
    try {
      const data = {
        mensajes: this.mensajes(),
        comandaItems: this.comandaItems(),
        codigoPedidoExitoso: this.codigoPedidoExitoso(),
        pedidoConfirmadoExitoso: this.pedidoConfirmadoExitoso(),
      };
      sessionStorage.setItem(this.getStorageKey(), JSON.stringify(data));
    } catch (e) {
      console.warn('No se pudo guardar chat en sessionStorage:', e);
    }
  }

  recuperarDeSesion(): boolean {
    try {
      const raw = sessionStorage.getItem(this.getStorageKey());
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (Array.isArray(data.mensajes) && data.mensajes.length > 0) {
        // Si el chat almacenado tiene mensajes de pago o la cuenta ya se liquidó, no restaurar historial viejo
        const tienePago = data.mensajes.some(
          (m: any) =>
            m.id?.startsWith('pago-') ||
            (typeof m.texto === 'string' && m.texto.includes('ha sido cancelada con éxito')),
        );
        if (tienePago) {
          sessionStorage.removeItem(this.getStorageKey());
          return false;
        }

        const parseados = data.mensajes.map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }));
        this.mensajes.set(parseados);
        if (Array.isArray(data.comandaItems)) {
          this.comandaItems.set(data.comandaItems);
        }
        if (data.codigoPedidoExitoso) {
          this.codigoPedidoExitoso.set(data.codigoPedidoExitoso);
        }
        if (data.pedidoConfirmadoExitoso) {
          this.pedidoConfirmadoExitoso.set(data.pedidoConfirmadoExitoso);
        }
        return true;
      }
    } catch (e) {
      console.warn('Error recuperando chat de sessionStorage:', e);
    }
    return false;
  }

  /**
   * Reinicia la atención para un nuevo comensal en la mesa.
   * Limpia almacenamiento en sesión, carrito, comanda en borrador y genera el saludo de bienvenida.
   */
  reiniciarChatParaNuevoComensal(): void {
    try {
      sessionStorage.removeItem(this.getStorageKey());
    } catch (e) {}

    this.comandaItems.set([]);
    this.pedidoActivoBackend.set(null);
    this.pedidoConfirmadoExitoso.set(false);
    this.codigoPedidoExitoso.set('');
    this.carritoService.limpiarCarrito();

    const hora = new Date().getHours();
    let saludoHora = '¡Buenas tardes!';
    if (hora >= 6 && hora < 12) saludoHora = '¡Buenos días!';
    else if (hora >= 19 || hora < 6) saludoHora = '¡Buenas noches!';

    this.mensajes.set([
      {
        id: `init-${Date.now()}`,
        emisor: 'don-beto',
        texto:
          `${saludoHora} Sea muy bienvenido. Es un gusto tenerlo con nosotros en la **Mesa ${this.mesaDisplay()}**. Póngase cómodo, por favor.\n\n` +
          `Soy **Don Beto** y estoy a su entera disposición. Tómese su tiempo con la carta, o dígame con toda confianza qué se le antoja hoy: ¿le gustaría empezar con una jarrita de hervido calientito o prefiere que le vaya anotando algún platito tradicional?`,
        timestamp: new Date(),
      },
    ]);
    this.guardarEnSesion();
    this.shouldScroll = true;
  }

  irAPagar(): void {
    this.router.navigate(['/cierre-cuenta'], {
      queryParams: { mesa: this.mesaBackend() },
    });
  }

  private scrollToBottom(): void {
    try {
      if (this.chatContainer?.nativeElement) {
        this.chatContainer.nativeElement.scrollTop =
          this.chatContainer.nativeElement.scrollHeight;
      }
    } catch (_) {}
  }

  getFoodEmoji(nombre: string): string {
    const n = (nombre || '').toLowerCase();
    if (n.includes('pique')) return '🥩';
    if (n.includes('charque')) return '🥩';
    if (n.includes('planch')) return '🍳';
    if (n.includes('coca') || n.includes('gaseosa') || n.includes('sprite') || n.includes('fanta') || n.includes('simba')) return '🥤';
    if (n.includes('cerveza') || n.includes('huari') || n.includes('pacen')) return '🍺';
    if (n.includes('caldo') || n.includes('kawi') || n.includes('rinon') || n.includes('chanka')) return '🍲';
    if (n.includes('hervido')) return '🍵';
    return '🍽️';
  }
}
