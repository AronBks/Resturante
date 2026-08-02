import { Component } from '@angular/core';
import { ChatMeseroComponent } from '../chat-mesero/chat-mesero.component';

@Component({
  selector: 'client-ia-comanda',
  standalone: true,
  imports: [ChatMeseroComponent],
  template: `<client-chat-mesero></client-chat-mesero>`,
})
export class IaComandaComponent {}
