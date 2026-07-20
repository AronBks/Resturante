import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  LayoutDashboard,
  Grid,
  Wallet,
  Landmark,
  UtensilsCrossed,
  Users,
  LogOut,
  Bell,
  Send,
  Plus,
  Minus,
  Trash2,
  Eye,
  Pencil,
  Search,
  Printer,
  Check,
  CheckCircle2,
  X,
  Clock,
  DollarSign,
  Coins,
  Lock,
  CreditCard,
  Banknote,
  AlertCircle,
  Camera,
  Upload,
  Link,
  Sparkles,
  Bot,
  Beer,
  Cake,
  Beef,
  Soup
} from 'lucide-angular';

export const appIcons = {
  LayoutDashboard,
  Grid,
  Wallet,
  Landmark,
  UtensilsCrossed,
  Users,
  LogOut,
  Bell,
  Send,
  Plus,
  Minus,
  Trash2,
  Eye,
  Pencil,
  Search,
  Printer,
  Check,
  CheckCircle2,
  X,
  Clock,
  DollarSign,
  Coins,
  Lock,
  CreditCard,
  Banknote,
  AlertCircle,
  Camera,
  Upload,
  Link,
  Sparkles,
  Bot,
  Beer,
  Cake,
  Beef,
  Soup
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(appIcons) }
  ]
};

