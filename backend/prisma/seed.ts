import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed oficial — Peña Restaurant Tukuypaj...\n');

  // ── Limpieza previa ──
  console.log('🗑️  Limpiando datos anteriores...');
  await prisma.transaccion.deleteMany({});
  await prisma.caja.deleteMany({});
  await prisma.detallePedido.deleteMany({});
  await prisma.pedido.deleteMany({});
  await prisma.variantePlato.deleteMany({});
  await prisma.plato.deleteMany({});
  await prisma.categoriaPlato.deleteMany({});
  await prisma.mesa.deleteMany({});
  await prisma.usuario.deleteMany({});
  console.log('✅ Base de datos limpia.\n');

  // ── 1. USUARIOS ──
  const salt = await bcrypt.genSalt(10);

  await prisma.usuario.createMany({
    data: [
      {
        nombre: 'Don Roberto Mamani',
        email: 'admin@tukuypaj.com',
        passwordHash: await bcrypt.hash('admin123', salt),
        rol: RolUsuario.ADMIN,
      },
      {
        nombre: 'Carlos Condori',
        email: 'carlos@tukuypaj.com',
        passwordHash: await bcrypt.hash('mesero123', salt),
        rol: RolUsuario.MESERO,
      },
      {
        nombre: 'Lucía Fernández',
        email: 'lucia@tukuypaj.com',
        passwordHash: await bcrypt.hash('mesero123', salt),
        rol: RolUsuario.MESERO,
      },
      {
        nombre: 'Chef Miguel Ángel Torres',
        email: 'chef.miguel@tukuypaj.com',
        passwordHash: await bcrypt.hash('chef123', salt),
        rol: RolUsuario.CHEF,
      },
      {
        nombre: 'Ana Belén Rojas',
        email: 'cajera.ana@tukuypaj.com',
        passwordHash: await bcrypt.hash('cajero123', salt),
        rol: RolUsuario.CAJERO,
      },
      {
        nombre: 'Asistente IA Tukuypaj',
        email: 'ia@tukuypaj.com',
        passwordHash: await bcrypt.hash('ia-system-no-login', salt),
        rol: RolUsuario.MESERO,
        activo: true,
      },
    ],
  });
  console.log('✅ Usuarios creados (6)');

  // ── 2. MESAS ──
  const mesasData = [
    { numero: 'M01', capacidad: 6, posicion: { x: 80,  y: 180, zona: 'Zona Central' } },
    { numero: 'M02', capacidad: 4, posicion: { x: 230, y: 180, zona: 'Zona Central' } },
    { numero: 'M03', capacidad: 4, posicion: { x: 380, y: 180, zona: 'Zona Central' } },
    { numero: 'M04', capacidad: 6, posicion: { x: 530, y: 180, zona: 'Zona Central' } },
    { numero: 'M05', capacidad: 4, posicion: { x: 80,  y: 320, zona: 'Zona Ventanales' } },
    { numero: 'M06', capacidad: 2, posicion: { x: 230, y: 320, zona: 'Zona Ventanales' } },
    { numero: 'M07', capacidad: 4, posicion: { x: 380, y: 320, zona: 'Zona Ventanales' } },
    { numero: 'M08', capacidad: 2, posicion: { x: 530, y: 320, zona: 'Zona Ventanales' } },
    { numero: 'B01', capacidad: 2, posicion: { x: 700, y: 180, zona: 'Barra' } },
    { numero: 'B02', capacidad: 3, posicion: { x: 700, y: 320, zona: 'Barra' } },
  ];

  for (const mesa of mesasData) {
    await prisma.mesa.create({
      data: {
        numero: mesa.numero,
        capacidad: mesa.capacidad,
        posicion: JSON.stringify(mesa.posicion),
      },
    });
  }
  console.log('✅ Mesas creadas (10)');

  // ── 3. CATEGORÍAS ──
  const catPlatos = await prisma.categoriaPlato.create({
    data: { nombre: 'Platos', descripcion: 'Platos principales — disponibles desde las 12:00', orden: 1 },
  });
  const catCaldos = await prisma.categoriaPlato.create({
    data: { nombre: 'Caldos', descripcion: 'Caldos de mañana — disponibles de 9:00 a 13:00', orden: 2 },
  });
  const catGaseosas = await prisma.categoriaPlato.create({
    data: { nombre: 'Gaseosas', descripcion: 'Refrescos y bebidas frías', orden: 3 },
  });
  const catJugos = await prisma.categoriaPlato.create({
    data: { nombre: 'Jugos', descripcion: 'Jugos y bebidas naturales', orden: 4 },
  });
  const catHervidos = await prisma.categoriaPlato.create({
    data: { nombre: 'Hervidos', descripcion: 'Hervidos artesanales en jarra', orden: 5 },
  });
  const catCerveza = await prisma.categoriaPlato.create({
    data: { nombre: 'Cerveza', descripcion: 'Cervezas nacionales', orden: 6 },
  });
  console.log('✅ Categorías creadas (6)');

  // ── 4. PLATOS PRINCIPALES (disponibles 12:00 - cierre) ──
  const IMG = {
    pique:     'https://res.cloudinary.com/dwquu4l5w/image/upload/v1784584010/Pique-macho-Cochabambino-500x500_t5gbnw.webp',
    charque:   'https://res.cloudinary.com/dwquu4l5w/image/upload/v1784584019/128-image_web_q0hfc9.jpg',
    planchita: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=80',
    matambre:  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
    lapping:   'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80',
    pampa:     'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    picante:   'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
    caldo:     'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
    gaseosa:   'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
    jugo:      'https://res.cloudinary.com/dwquu4l5w/image/upload/v1784584179/images_jwo1pg.jpg',
    hervido:   'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
    cerveza:   'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=800&q=80',
  };

  const platosData = [
    // ── PLATOS (12:00 - 17:00) ──
    {
      nombre: 'Pique',
      descripcion: 'Trozos de lomo de res y salchicha salteados con papas fritas, locoto, tomate, cebolla y huevo. El orgullo de Tukuypaj.',
      precioVenta: 80,
      imagenUrl: IMG.pique,
      categoriaId: catPlatos.id,
      horaInicio: '12:00',
      horaFin: '17:00',
      variantes: [
        { nombre: 'Entero', precio: 120 },
        { nombre: 'Medio', precio: 80 },
        { nombre: 'Pique Tukuypaj (Especial)', precio: 180 },
      ],
    },
    {
      nombre: 'Charque',
      descripcion: 'Carne de res charqueada y frita, servida con mote, chuño y ensalada fresca.',
      precioVenta: 80,
      imagenUrl: IMG.charque,
      categoriaId: catPlatos.id,
      horaInicio: '12:00',
      horaFin: '17:00',
      variantes: [
        { nombre: 'Entero', precio: 120 },
        { nombre: 'Medio', precio: 80 },
      ],
    },
    {
      nombre: 'Planchita',
      descripcion: 'Filete de res a la plancha con papas doradas, arroz blanco y ensalada mixta.',
      precioVenta: 120,
      imagenUrl: IMG.planchita,
      categoriaId: catPlatos.id,
      horaInicio: '12:00',
      horaFin: '17:00',
      variantes: [
        { nombre: 'Entero', precio: 120 },
      ],
    },
    {
      nombre: 'Matambre',
      descripcion: 'Carne de res enrollada con relleno criollo, cocida a la parrilla. Clásico de la peña.',
      precioVenta: 80,
      imagenUrl: IMG.matambre,
      categoriaId: catPlatos.id,
      horaInicio: '12:00',
      horaFin: '17:00',
      variantes: [
        { nombre: 'Entero', precio: 120 },
        { nombre: 'Medio', precio: 80 },
      ],
    },
    {
      nombre: 'Lapping',
      descripcion: 'Plato individual de carne de cordero al horno con acompañamiento tradicional.',
      precioVenta: 80,
      imagenUrl: IMG.lapping,
      categoriaId: catPlatos.id,
      horaInicio: '12:00',
      horaFin: '17:00',
    },
    {
      nombre: "Pamp'aku",
      descripcion: "Carne de res asada al estilo pamp'aku, envuelta en panca y cocida a las brasas. Sabor único.",
      precioVenta: 80,
      imagenUrl: IMG.pampa,
      categoriaId: catPlatos.id,
      horaInicio: '12:00',
      horaFin: '17:00',
      variantes: [
        { nombre: 'Entero', precio: 120 },
        { nombre: 'Medio', precio: 80 },
      ],
    },
    {
      nombre: 'Picante Mixto',
      descripcion: 'Combinación de pollo y lengua en salsa picante cochabambina. Plato individual.',
      precioVenta: 80,
      imagenUrl: IMG.picante,
      categoriaId: catPlatos.id,
      horaInicio: '12:00',
      horaFin: '17:00',
    },

    // ── CALDOS (09:00 - 13:00) ──
    {
      nombre: 'Kawi',
      descripcion: 'Caldo de pata de res, reconfortante y sustancioso. Disponible solo en la mañana.',
      precioVenta: 22,
      imagenUrl: IMG.caldo,
      categoriaId: catCaldos.id,
      horaInicio: '09:00',
      horaFin: '13:00',
    },
    {
      nombre: 'Caldo de Cola',
      descripcion: 'Caldo de cola de res con papa, nabo y hierbas aromáticas. Ideal para la mañana.',
      precioVenta: 22,
      imagenUrl: IMG.caldo,
      categoriaId: catCaldos.id,
      horaInicio: '09:00',
      horaFin: '13:00',
    },
    {
      nombre: 'Riñón',
      descripcion: 'Caldo de riñón de res sazonado con especias y papas. Listo desde las 9:00.',
      precioVenta: 22,
      imagenUrl: IMG.caldo,
      categoriaId: catCaldos.id,
      horaInicio: '09:00',
      horaFin: '13:00',
    },
    {
      nombre: 'Riñón al Perol',
      descripcion: 'Riñón de res preparado al perol con locoto y cebolla. Versión especial más completa.',
      precioVenta: 28,
      imagenUrl: IMG.caldo,
      categoriaId: catCaldos.id,
      horaInicio: '09:00',
      horaFin: '13:00',
    },
    {
      nombre: 'Chanka de Pollo',
      descripcion: 'Sopa espesa de pollo con papa, chuño y ají amarillo cochabambino.',
      precioVenta: 22,
      imagenUrl: IMG.caldo,
      categoriaId: catCaldos.id,
      horaInicio: '09:00',
      horaFin: '13:00',
    },
    {
      nombre: 'Pulpito',
      descripcion: 'Caldo de menudencia de res con verduras y hierbas. Reconfortante y nutritivo.',
      precioVenta: 22,
      imagenUrl: IMG.caldo,
      categoriaId: catCaldos.id,
      horaInicio: '09:00',
      horaFin: '13:00',
    },
    {
      nombre: 'Mixto',
      descripcion: 'La combinación perfecta: Pollo, Cola y Kawi en un solo caldo. El favorito de la mañana.',
      precioVenta: 28,
      imagenUrl: IMG.caldo,
      categoriaId: catCaldos.id,
      horaInicio: '09:00',
      horaFin: '13:00',
    },

    // ── GASEOSAS ──
    {
      nombre: 'Coca Cola',
      descripcion: 'Botella personal 500ml.',
      precioVenta: 20,
      imagenUrl: IMG.gaseosa,
      categoriaId: catGaseosas.id,
    },
    {
      nombre: 'Fanta',
      descripcion: 'Botella personal 500ml.',
      precioVenta: 20,
      imagenUrl: IMG.gaseosa,
      categoriaId: catGaseosas.id,
    },
    {
      nombre: 'Sprite',
      descripcion: 'Botella personal 500ml.',
      precioVenta: 20,
      imagenUrl: IMG.gaseosa,
      categoriaId: catGaseosas.id,
    },
    {
      nombre: 'Simba',
      descripcion: 'Refresco de cola nacional. Botella personal.',
      precioVenta: 18,
      imagenUrl: IMG.gaseosa,
      categoriaId: catGaseosas.id,
    },
    {
      nombre: 'Cascada',
      descripcion: 'Bebida refrescante de frutas. Botella personal.',
      precioVenta: 18,
      imagenUrl: IMG.gaseosa,
      categoriaId: catGaseosas.id,
    },

    // ── JUGOS ──
    {
      nombre: 'Del Valle',
      descripcion: 'Jugo de frutas natural Del Valle. Botella personal.',
      precioVenta: 18,
      imagenUrl: IMG.jugo,
      categoriaId: catJugos.id,
    },
    {
      nombre: 'Acuarius',
      descripcion: 'Bebida isotónica Acuarius. Botella personal.',
      precioVenta: 18,
      imagenUrl: IMG.jugo,
      categoriaId: catJugos.id,
    },
    {
      nombre: 'Pura Vida',
      descripcion: 'Jugo natural de frutas Pura Vida. Botella personal.',
      precioVenta: 18,
      imagenUrl: IMG.jugo,
      categoriaId: catJugos.id,
    },

    // ── HERVIDOS ──
    {
      nombre: 'Hervido',
      descripcion: 'Bebida caliente artesanal de hierbas y frutas. Preparado en jarra.',
      precioVenta: 10,
      imagenUrl: IMG.hervido,
      categoriaId: catHervidos.id,
      variantes: [
        { nombre: 'Jarra Media (Pequeño)', precio: 10 },
        { nombre: 'Jarra Entera (Grande)', precio: 20 },
      ],
    },

    // ── CERVEZA ──
    {
      nombre: 'Huari',
      descripcion: 'Cerveza nacional boliviana Huari. Botella.',
      precioVenta: 25,
      imagenUrl: IMG.cerveza,
      categoriaId: catCerveza.id,
    },
    {
      nombre: 'Paceña',
      descripcion: 'Cerveza nacional boliviana Paceña. Botella.',
      precioVenta: 20,
      imagenUrl: IMG.cerveza,
      categoriaId: catCerveza.id,
    },
  ];

  for (const plato of platosData) {
    const { variantes, horaInicio, horaFin, ...platoBase } = plato as any;
    await prisma.plato.create({
      data: {
        ...platoBase,
        horaInicio: horaInicio ?? null,
        horaFin: horaFin ?? null,
        variantes: variantes
          ? { create: variantes.map((v: any) => ({ nombre: v.nombre, precio: v.precio })) }
          : undefined,
      },
    });
  }
  console.log(`✅ Platos y bebidas creados (${platosData.length})`);

  // ── Resumen ──
  console.log('\n════════════════════════════════════════════');
  console.log('  🎭 Peña Tukuypaj — Carta Oficial Cargada');
  console.log('  📋 7 Platos | 7 Caldos | 11 Bebidas');
  console.log('════════════════════════════════════════════\n');
  console.log('  🔑 Credenciales:');
  console.log('     admin@tukuypaj.com / admin123');
  console.log('     cajera.ana@tukuypaj.com / cajero123');
  console.log('     chef.miguel@tukuypaj.com / chef123');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
