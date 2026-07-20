import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed limpio — Peña Restaurant Tukuypaj...\n');

  // ── Limpieza previa de la Base de Datos ──
  console.log('🗑️ Limpiando registros anteriores...');
  await prisma.transaccion.deleteMany({});
  await prisma.caja.deleteMany({});
  await prisma.detallePedido.deleteMany({});
  await prisma.pedido.deleteMany({});
  await prisma.plato.deleteMany({});
  await prisma.categoriaPlato.deleteMany({});
  await prisma.mesa.deleteMany({});
  await prisma.usuario.deleteMany({});
  console.log('🗑️ Base de datos limpia.\n');

  // ── 1. Usuarios del sistema ──
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('admin123', salt);

  await prisma.usuario.upsert({
    where: { email: 'admin@tukuypaj.com' },
    update: {},
    create: {
      nombre: 'Don Roberto Mamani',
      email: 'admin@tukuypaj.com',
      passwordHash,
      rol: RolUsuario.ADMIN,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'carlos@tukuypaj.com' },
    update: {},
    create: {
      nombre: 'Carlos Mendoza',
      email: 'carlos@tukuypaj.com',
      passwordHash: await bcrypt.hash('mesero123', salt),
      rol: RolUsuario.MESERO,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'lucia@tukuypaj.com' },
    update: {},
    create: {
      nombre: 'Lucía Fernández',
      email: 'lucia@tukuypaj.com',
      passwordHash: await bcrypt.hash('mesero123', salt),
      rol: RolUsuario.MESERO,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'chef.miguel@tukuypaj.com' },
    update: {},
    create: {
      nombre: 'Chef Miguel Ángel Torres',
      email: 'chef.miguel@tukuypaj.com',
      passwordHash: await bcrypt.hash('chef123', salt),
      rol: RolUsuario.CHEF,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'cajera.ana@tukuypaj.com' },
    update: {},
    create: {
      nombre: 'Ana Belén Rojas',
      email: 'cajera.ana@tukuypaj.com',
      passwordHash: await bcrypt.hash('cajero123', salt),
      rol: RolUsuario.CAJERO,
    },
  });

  // Usuario virtual del Sistema IA — actúa como mesero en pedidos autónomos
  await prisma.usuario.upsert({
    where: { email: 'ia@tukuypaj.com' },
    update: {},
    create: {
      nombre: 'Asistente IA Tukuypaj',
      email: 'ia@tukuypaj.com',
      passwordHash: await bcrypt.hash('ia-system-no-login', salt),
      rol: RolUsuario.MESERO,
      activo: true,
    },
  });

  console.log('✅ Equipo de trabajo creado (6 — incluye Asistente IA)');

  // ── 2. Mesas — Distribución Diaria normal ──
  const mesasData = [
    // Zona Central
    { numero: 'M01', capacidad: 6, posicion: { x: 80, y: 180, zona: 'Zona Central' } },
    { numero: 'M02', capacidad: 4, posicion: { x: 230, y: 180, zona: 'Zona Central' } },
    { numero: 'M03', capacidad: 4, posicion: { x: 380, y: 180, zona: 'Zona Central' } },
    { numero: 'M04', capacidad: 6, posicion: { x: 530, y: 180, zona: 'Zona Central' } },
    // Zona Ventanales
    { numero: 'M05', capacidad: 4, posicion: { x: 80, y: 320, zona: 'Zona Ventanales' } },
    { numero: 'M06', capacidad: 2, posicion: { x: 230, y: 320, zona: 'Zona Ventanales' } },
    { numero: 'M07', capacidad: 4, posicion: { x: 380, y: 320, zona: 'Zona Ventanales' } },
    { numero: 'M08', capacidad: 2, posicion: { x: 530, y: 320, zona: 'Zona Ventanales' } },
    // Barra
    { numero: 'B01', capacidad: 2, posicion: { x: 700, y: 180, zona: 'Barra' } },
    { numero: 'B02', capacidad: 3, posicion: { x: 700, y: 320, zona: 'Barra' } },
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

  console.log('✅ Mesas creadas (10) — Zonas: Central(4), Ventanales(4), Barra(2)');

  // ── 3. Categorías de platos — Gastronomía cochabambina ──
  const catTradicionales = await prisma.categoriaPlato.upsert({
    where: { nombre: 'Tradicionales Cochabambinos' },
    update: {},
    create: { nombre: 'Tradicionales Cochabambinos', descripcion: 'Lo mejor de la gastronomía valluna', orden: 1 },
  });

  const catParrillas = await prisma.categoriaPlato.upsert({
    where: { nombre: 'Parrillas & Carnes' },
    update: {},
    create: { nombre: 'Parrillas & Carnes', descripcion: 'Cortes selectos a la parrilla', orden: 2 },
  });

  const catSopas = await prisma.categoriaPlato.upsert({
    where: { nombre: 'Sopas & Caldos' },
    update: {},
    create: { nombre: 'Sopas & Caldos', descripcion: 'Sopas reconfortantes de la tradición', orden: 3 },
  });

  const catEntradas = await prisma.categoriaPlato.upsert({
    where: { nombre: 'Entradas & Picoteo' },
    update: {},
    create: { nombre: 'Entradas & Picoteo', descripcion: 'Para compartir en la peña', orden: 4 },
  });

  const catBebidas = await prisma.categoriaPlato.upsert({
    where: { nombre: 'Bebidas' },
    update: {},
    create: { nombre: 'Bebidas', descripcion: 'Refrescos, jugos y chicha', orden: 5 },
  });

  const catPostres = await prisma.categoriaPlato.upsert({
    where: { nombre: 'Postres' },
    update: {},
    create: { nombre: 'Postres', descripcion: 'Dulces cochabambinos para cerrar', orden: 6 },
  });

  console.log('✅ Categorías creadas (6)');

  // ── 4. Platos con y sin variantes ──
  const platosData = [
    // Tradicionales Cochabambinos
    {
      nombre: 'Pique Macho Tukuypaj',
      descripcion: 'Trozos de lomo de res y salchicha salteados con papas fritas, locoto, tomate, cebolla y huevo. El orgullo de Cochabamba.',
      precioVenta: 55,
      imagenUrl: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1784584010/Pique-macho-Cochabambino-500x500_t5gbnw.webp',
      categoriaId: catTradicionales.id,
      variantes: [
        { nombre: 'Personal', precio: 40 },
        { nombre: 'Mediano', precio: 90 },
        { nombre: 'Grande', precio: 150 },
      ]
    },
    {
      nombre: 'Silpancho Cochabambino',
      descripcion: 'Filete de res empanizado sobre cama de arroz y papas, coronado con huevo frito, ensalada de tomate y locoto.',
      precioVenta: 42,
      imagenUrl: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80',
      categoriaId: catTradicionales.id,
    },
    {
      nombre: 'Chicharrón de Cerdo',
      descripcion: 'Carne de cerdo cocida en su propia grasa hasta dorar, servida con mote, llajua y chuño.',
      precioVenta: 48,
      imagenUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=80',
      categoriaId: catTradicionales.id,
      variantes: [
        { nombre: 'Personal', precio: 35 },
        { nombre: 'Mediano', precio: 65 },
        { nombre: 'Grande', precio: 90 },
      ]
    },
    {
      nombre: 'Trancapecho',
      descripcion: 'Sándwich gigante con filete empanizado, huevo frito, arroz, ensalada, papas fritas y salsa picante.',
      precioVenta: 35,
      imagenUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
      categoriaId: catTradicionales.id,
    },
    // Parrillas & Carnes
    {
      nombre: 'Parrillada Tukuypaj (2 personas)',
      descripcion: 'Lomo, costilla, chorizo criollo y pollo a la parrilla con papas doradas, ensalada mixta y llajua.',
      precioVenta: 130,
      imagenUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
      categoriaId: catParrillas.id,
      variantes: [
        { nombre: 'Simple', precio: 70 },
        { nombre: 'Doble (2 personas)', precio: 130 },
        { nombre: 'Familiar (4 personas)', precio: 240 },
      ]
    },
    {
      nombre: 'Lomo a la Plancha',
      descripcion: 'Corte de lomo fino a la plancha con arroz, papas fritas y ensalada criolla.',
      precioVenta: 45,
      imagenUrl: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1784584019/128-image_web_q0hfc9.jpg',
      categoriaId: catParrillas.id,
    },
    // Sopas & Caldos
    {
      nombre: 'Chanka de Pollo',
      descripcion: 'Sopa espesa de pollo cochabambino con papas, chuño y ají amarillo. Reconfortante y sustanciosa.',
      precioVenta: 38,
      imagenUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
      categoriaId: catSopas.id,
    },
    {
      nombre: 'Sopa de Maní',
      descripcion: 'Clásica sopa cochabambina con caldo de res, pasta de maní, papas y fideo.',
      precioVenta: 30,
      imagenUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
      categoriaId: catSopas.id,
    },
    // Entradas & Picoteo
    {
      nombre: 'Anticuchos de Corazón',
      descripcion: 'Brochetas de corazón de res marinadas con ají panca, servidas con papas y salsa de maní.',
      precioVenta: 28,
      imagenUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
      categoriaId: catEntradas.id,
    },
    {
      nombre: 'Ranga Ranga',
      descripcion: 'Guiso picante de librillo de res con papas, cebolla, locoto y hierbas aromáticas.',
      precioVenta: 32,
      imagenUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
      categoriaId: catEntradas.id,
    },
    // Bebidas
    {
      nombre: 'Chicha Cochabambina',
      descripcion: 'Bebida ancestral de maíz fermentado, refrescante y tradicional.',
      precioVenta: 12,
      imagenUrl: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1784584024/wpid-wp-1416759558226_xwfdh8.jpg',
      categoriaId: catBebidas.id,
    },
    {
      nombre: 'Limonada con Hierba Buena',
      descripcion: 'Jugo de limón natural con hierba buena fresca y un toque de azúcar.',
      precioVenta: 10,
      imagenUrl: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1784584179/images_jwo1pg.jpg',
      categoriaId: catBebidas.id,
      variantes: [
        { nombre: 'Vaso', precio: 10 },
        { nombre: 'Jarra 1Lt', precio: 25 },
        { nombre: 'Jarra 2Lt', precio: 45 },
      ]
    },
    {
      nombre: 'Refresco en Botella',
      descripcion: 'Coca-Cola, Sprite o Fanta — botella personal 500ml.',
      precioVenta: 8,
      imagenUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
      categoriaId: catBebidas.id,
    },
    // Postres
    {
      nombre: 'Helado de Canela',
      descripcion: 'Helado artesanal de canela sobre bizcocho de vainilla con salsa de caramelo.',
      precioVenta: 18,
      imagenUrl: 'https://images.unsplash.com/photo-1560008511-11c63416e52d?auto=format&fit=crop&w=800&q=80',
      categoriaId: catPostres.id,
    },
    {
      nombre: 'Buñuelos con Miel',
      descripcion: 'Buñuelos crujientes de yuca bañados en miel de caña artesanal.',
      precioVenta: 15,
      imagenUrl: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80',
      categoriaId: catPostres.id,
    },
  ];

  for (const plato of platosData) {
    const { variantes, ...platoRest } = plato;
    await prisma.plato.create({
      data: {
        ...platoRest,
        variantes: variantes
          ? {
              create: variantes.map((v) => ({
                nombre: v.nombre,
                precio: v.precio,
              })),
            }
          : undefined,
      },
    });
  }

  console.log('✅ Platos creados con variantes (15)');

  // ── Resumen ──
  console.log('\n════════════════════════════════════════');
  console.log('  🎭 Peña Tukuypaj — Seed Completado (Limpio)');
  console.log('════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
