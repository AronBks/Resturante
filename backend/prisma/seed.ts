import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos SGGI...\n');

  // ── 1. Usuarios del sistema ──
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('admin123', salt);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@sggi.com' },
    update: {},
    create: {
      nombre: 'Administrador',
      email: 'admin@sggi.com',
      passwordHash,
      rol: RolUsuario.ADMIN,
    },
  });

  const mesero1 = await prisma.usuario.upsert({
    where: { email: 'carlos.mesero@sggi.com' },
    update: {},
    create: {
      nombre: 'Carlos Mendoza',
      email: 'carlos.mesero@sggi.com',
      passwordHash: await bcrypt.hash('mesero123', salt),
      rol: RolUsuario.MESERO,
    },
  });

  const mesero2 = await prisma.usuario.upsert({
    where: { email: 'lucia.mesera@sggi.com' },
    update: {},
    create: {
      nombre: 'Lucía Fernández',
      email: 'lucia.mesera@sggi.com',
      passwordHash: await bcrypt.hash('mesero123', salt),
      rol: RolUsuario.MESERO,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'chef.miguel@sggi.com' },
    update: {},
    create: {
      nombre: 'Miguel Ángel Torres',
      email: 'chef.miguel@sggi.com',
      passwordHash: await bcrypt.hash('chef123', salt),
      rol: RolUsuario.CHEF,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'cajera.ana@sggi.com' },
    update: {},
    create: {
      nombre: 'Ana Belén Rojas',
      email: 'cajera.ana@sggi.com',
      passwordHash: await bcrypt.hash('cajero123', salt),
      rol: RolUsuario.CAJERO,
    },
  });

  console.log('✅ Usuarios creados (5)');

  // ── 2. Mesas del restaurante ──
  const mesasData = [
    { numero: 'M01', capacidad: 4, posicion: { x: 100, y: 100, rotacion: 0 } },
    { numero: 'M02', capacidad: 4, posicion: { x: 250, y: 100, rotacion: 0 } },
    { numero: 'M03', capacidad: 2, posicion: { x: 400, y: 100, rotacion: 0 } },
    { numero: 'M04', capacidad: 6, posicion: { x: 100, y: 250, rotacion: 0 } },
    { numero: 'M05', capacidad: 4, posicion: { x: 250, y: 250, rotacion: 0 } },
    { numero: 'M06', capacidad: 2, posicion: { x: 400, y: 250, rotacion: 0 } },
    { numero: 'M07', capacidad: 8, posicion: { x: 100, y: 400, rotacion: 0 } },
    { numero: 'M08', capacidad: 4, posicion: { x: 250, y: 400, rotacion: 0 } },
    { numero: 'M09', capacidad: 6, posicion: { x: 400, y: 400, rotacion: 0 } },
    { numero: 'M10', capacidad: 10, posicion: { x: 250, y: 550, rotacion: 0 } },
  ];

  for (const mesa of mesasData) {
    await prisma.mesa.upsert({
      where: { numero: mesa.numero },
      update: {},
      create: {
        numero: mesa.numero,
        capacidad: mesa.capacidad,
        posicion: JSON.stringify(mesa.posicion),
      },
    });
  }

  console.log('✅ Mesas creadas (10)');

  // ── 3. Categorías de platos ──
  const categorias = await Promise.all([
    prisma.categoriaPlato.upsert({
      where: { nombre: 'Entradas' },
      update: {},
      create: { nombre: 'Entradas', descripcion: 'Platos para empezar', orden: 1 },
    }),
    prisma.categoriaPlato.upsert({
      where: { nombre: 'Platos Principales' },
      update: {},
      create: { nombre: 'Platos Principales', descripcion: 'Platos fuertes del menú', orden: 2 },
    }),
    prisma.categoriaPlato.upsert({
      where: { nombre: 'Parrilladas' },
      update: {},
      create: { nombre: 'Parrilladas', descripcion: 'Carnes a la parrilla', orden: 3 },
    }),
    prisma.categoriaPlato.upsert({
      where: { nombre: 'Sopas y Caldos' },
      update: {},
      create: { nombre: 'Sopas y Caldos', descripcion: 'Sopas caseras', orden: 4 },
    }),
    prisma.categoriaPlato.upsert({
      where: { nombre: 'Bebidas' },
      update: {},
      create: { nombre: 'Bebidas', descripcion: 'Refrescos, jugos y licuados', orden: 5 },
    }),
    prisma.categoriaPlato.upsert({
      where: { nombre: 'Postres' },
      update: {},
      create: { nombre: 'Postres', descripcion: 'Dulces para cerrar', orden: 6 },
    }),
  ]);

  console.log('✅ Categorías creadas (6)');

  // ── 4. Ingredientes del inventario ──
  const ingredientes: Record<string, string> = {};

  const ingredientesData = [
    { nombre: 'Lomo de res', unidadMedida: 'KG' as const, stockActual: 25, umbralMinimo: 5, umbralCritico: 2, precioUnitario: 45 },
    { nombre: 'Pechuga de pollo', unidadMedida: 'KG' as const, stockActual: 30, umbralMinimo: 8, umbralCritico: 3, precioUnitario: 22 },
    { nombre: 'Arroz', unidadMedida: 'KG' as const, stockActual: 50, umbralMinimo: 10, umbralCritico: 5, precioUnitario: 5 },
    { nombre: 'Papa', unidadMedida: 'KG' as const, stockActual: 40, umbralMinimo: 10, umbralCritico: 5, precioUnitario: 4 },
    { nombre: 'Cebolla', unidadMedida: 'KG' as const, stockActual: 20, umbralMinimo: 5, umbralCritico: 2, precioUnitario: 3 },
    { nombre: 'Tomate', unidadMedida: 'KG' as const, stockActual: 15, umbralMinimo: 4, umbralCritico: 2, precioUnitario: 4 },
    { nombre: 'Aceite vegetal', unidadMedida: 'L' as const, stockActual: 20, umbralMinimo: 5, umbralCritico: 2, precioUnitario: 8 },
    { nombre: 'Sal', unidadMedida: 'KG' as const, stockActual: 10, umbralMinimo: 2, umbralCritico: 1, precioUnitario: 2 },
    { nombre: 'Lechuga', unidadMedida: 'KG' as const, stockActual: 8, umbralMinimo: 2, umbralCritico: 1, precioUnitario: 6 },
    { nombre: 'Queso mozzarella', unidadMedida: 'KG' as const, stockActual: 10, umbralMinimo: 3, umbralCritico: 1, precioUnitario: 35 },
    { nombre: 'Salsa soya', unidadMedida: 'L' as const, stockActual: 5, umbralMinimo: 1, umbralCritico: 0.5, precioUnitario: 12 },
    { nombre: 'Costilla de cerdo', unidadMedida: 'KG' as const, stockActual: 15, umbralMinimo: 4, umbralCritico: 2, precioUnitario: 38 },
    { nombre: 'Chorizo', unidadMedida: 'KG' as const, stockActual: 10, umbralMinimo: 3, umbralCritico: 1, precioUnitario: 28 },
    { nombre: 'Limón', unidadMedida: 'KG' as const, stockActual: 8, umbralMinimo: 2, umbralCritico: 1, precioUnitario: 5 },
    { nombre: 'Azúcar', unidadMedida: 'KG' as const, stockActual: 15, umbralMinimo: 3, umbralCritico: 1, precioUnitario: 4 },
    { nombre: 'Leche', unidadMedida: 'L' as const, stockActual: 20, umbralMinimo: 5, umbralCritico: 2, precioUnitario: 6 },
    { nombre: 'Fideo', unidadMedida: 'KG' as const, stockActual: 15, umbralMinimo: 3, umbralCritico: 1, precioUnitario: 5 },
    { nombre: 'Zanahoria', unidadMedida: 'KG' as const, stockActual: 10, umbralMinimo: 3, umbralCritico: 1, precioUnitario: 4 },
  ];

  for (const ing of ingredientesData) {
    const created = await prisma.ingrediente.upsert({
      where: { nombre: ing.nombre },
      update: {},
      create: ing,
    });
    ingredientes[ing.nombre] = created.id;
  }

  console.log('✅ Ingredientes creados (18)');

  // ── 5. Platos con recetas ──
  const [catEntradas, catPrincipales, catParrilladas, catSopas, catBebidas, catPostres] = categorias;

  // Helper para crear plato con receta
  async function crearPlatoConReceta(
    nombre: string,
    descripcion: string,
    precioVenta: number,
    categoriaId: number,
    receta: { ingrediente: string; cantidad: number; unidad: string }[],
  ) {
    const plato = await prisma.plato.create({
      data: {
        nombre,
        descripcion,
        precioVenta,
        categoriaId,
      },
    });

    for (const item of receta) {
      const ingId = ingredientes[item.ingrediente];
      if (ingId) {
        await prisma.recetaDetalle.create({
          data: {
            platoId: plato.id,
            ingredienteId: ingId,
            cantidadRequerida: item.cantidad,
            unidad: item.unidad as any,
          },
        });
      }
    }

    // Calcular costo de receta
    const detalles = await prisma.recetaDetalle.findMany({
      where: { platoId: plato.id },
      include: { ingrediente: { select: { precioUnitario: true } } },
    });

    const costoReceta = detalles.reduce((sum, d) => {
      return sum + Number(d.cantidadRequerida) * Number(d.ingrediente.precioUnitario);
    }, 0);

    await prisma.plato.update({
      where: { id: plato.id },
      data: { costoReceta: Math.round(costoReceta * 100) / 100 },
    });

    return plato;
  }

  // Entradas
  await crearPlatoConReceta('Ensalada César', 'Lechuga, crotones, queso parmesano y aderezo César', 25, catEntradas.id, [
    { ingrediente: 'Lechuga', cantidad: 0.15, unidad: 'KG' },
    { ingrediente: 'Queso mozzarella', cantidad: 0.05, unidad: 'KG' },
    { ingrediente: 'Aceite vegetal', cantidad: 0.02, unidad: 'L' },
  ]);

  await crearPlatoConReceta('Sopa de Fideo', 'Sopa casera con fideo y verduras', 18, catSopas.id, [
    { ingrediente: 'Fideo', cantidad: 0.1, unidad: 'KG' },
    { ingrediente: 'Zanahoria', cantidad: 0.05, unidad: 'KG' },
    { ingrediente: 'Cebolla', cantidad: 0.03, unidad: 'KG' },
    { ingrediente: 'Tomate', cantidad: 0.05, unidad: 'KG' },
    { ingrediente: 'Sal', cantidad: 0.005, unidad: 'KG' },
  ]);

  // Platos principales
  await crearPlatoConReceta('Lomo Saltado', 'Lomo de res salteado con cebolla, tomate y papas fritas', 45, catPrincipales.id, [
    { ingrediente: 'Lomo de res', cantidad: 0.25, unidad: 'KG' },
    { ingrediente: 'Cebolla', cantidad: 0.08, unidad: 'KG' },
    { ingrediente: 'Tomate', cantidad: 0.1, unidad: 'KG' },
    { ingrediente: 'Papa', cantidad: 0.15, unidad: 'KG' },
    { ingrediente: 'Salsa soya', cantidad: 0.015, unidad: 'L' },
    { ingrediente: 'Arroz', cantidad: 0.15, unidad: 'KG' },
  ]);

  await crearPlatoConReceta('Pollo a la Plancha', 'Pechuga de pollo a la plancha con arroz y ensalada', 35, catPrincipales.id, [
    { ingrediente: 'Pechuga de pollo', cantidad: 0.25, unidad: 'KG' },
    { ingrediente: 'Arroz', cantidad: 0.15, unidad: 'KG' },
    { ingrediente: 'Lechuga', cantidad: 0.05, unidad: 'KG' },
    { ingrediente: 'Tomate', cantidad: 0.05, unidad: 'KG' },
    { ingrediente: 'Aceite vegetal', cantidad: 0.02, unidad: 'L' },
  ]);

  await crearPlatoConReceta('Milanesa de Pollo', 'Pechuga empanizada con arroz y papas fritas', 38, catPrincipales.id, [
    { ingrediente: 'Pechuga de pollo', cantidad: 0.25, unidad: 'KG' },
    { ingrediente: 'Arroz', cantidad: 0.15, unidad: 'KG' },
    { ingrediente: 'Papa', cantidad: 0.15, unidad: 'KG' },
    { ingrediente: 'Aceite vegetal', cantidad: 0.1, unidad: 'L' },
  ]);

  // Parrilladas
  await crearPlatoConReceta('Parrillada para 2', 'Lomo, costilla, chorizo con papas y ensalada', 120, catParrilladas.id, [
    { ingrediente: 'Lomo de res', cantidad: 0.3, unidad: 'KG' },
    { ingrediente: 'Costilla de cerdo', cantidad: 0.3, unidad: 'KG' },
    { ingrediente: 'Chorizo', cantidad: 0.2, unidad: 'KG' },
    { ingrediente: 'Papa', cantidad: 0.3, unidad: 'KG' },
    { ingrediente: 'Lechuga', cantidad: 0.1, unidad: 'KG' },
    { ingrediente: 'Tomate', cantidad: 0.1, unidad: 'KG' },
  ]);

  // Bebidas (sin receta compleja)
  await prisma.plato.create({
    data: { nombre: 'Limonada Natural', descripcion: 'Jugo de limón con agua y azúcar', precioVenta: 10, categoriaId: catBebidas.id },
  });

  await prisma.plato.create({
    data: { nombre: 'Refresco en Lata', descripcion: 'Coca-Cola, Sprite o Fanta', precioVenta: 8, categoriaId: catBebidas.id },
  });

  // Postres
  await crearPlatoConReceta('Flan Casero', 'Flan de leche con caramelo', 15, catPostres.id, [
    { ingrediente: 'Leche', cantidad: 0.25, unidad: 'L' },
    { ingrediente: 'Azúcar', cantidad: 0.05, unidad: 'KG' },
  ]);

  console.log('✅ Platos con recetas creados (9)');

  // ── Resumen ──
  console.log('\n════════════════════════════════════════');
  console.log('  🍽️  SGGI — Seed completado exitosamente');
  console.log('════════════════════════════════════════');
  console.log(`\n📧 Admin login: admin@sggi.com / admin123`);
  console.log(`📧 Mesero login: carlos.mesero@sggi.com / mesero123`);
  console.log(`📧 Chef login: chef.miguel@sggi.com / chef123`);
  console.log(`📧 Cajera login: cajera.ana@sggi.com / cajero123\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
