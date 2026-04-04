Actúa como un Desarrollador Full-Stack Arquitecto (Expert Level). Tu objetivo es generar el código completo, funcional y listo para producción para un Sistema de Gestión de Clases de Gimnasio. Debes crear el Backend (API REST), Frontend (Web App) y Mobile App (iOS/Android).

### 1. Stack Tecnológico Estricto
- Base de Datos: MySQL 8.0+ (Motor InnoDB obligatorio para transacciones). Usa Prisma ORM o Sequelize para los modelos.
- Backend (API): Node.js con Express.js. Usa JWT para autenticación.
- Frontend (Web): React.js (Vite) con TailwindCSS.
- Mobile (iOS/Android): React Native (Expo) para garantizar compatibilidad multiplataforma de un solo golpe.

### 2. Base de Datos y Modelos
Define un esquema relacional normalizado. Todas las tablas deben usar InnoDB:
- Usuarios: id, nombre, email, password_hash, rol (ENUM: 'ADMIN', 'TEACHER', 'CLIENT').
- Clases: id, titulo, descripcion, teacher_id (FK), capacidad_maxima, fecha_hora_inicio, fecha_hora_fin.
- Reservas: id, user_id (FK), clase_id (FK), estado (ENUM: 'CONFIRMADA', 'CANCELADA').

### 3. Lógica de Negocio y Reglas Críticas (No omitir)
- RBAC (Role-Based Access Control):
  - Admin: CRUD total de Usuarios, Profesores y Clases. Asigna profesores a clases.
  - Profesor: Solo ve el calendario con las clases que tiene asignadas y los clientes apuntados.
  - Cliente: Ve el calendario general, puede reservar plaza y cancelar su reserva.
- Control de Aforo (Crítico): La reserva debe validarse transaccionalmente en MySQL. Debes usar `SELECT ... FOR UPDATE` (Row-Level Locking) al consultar la capacidad actual de la clase antes de insertar la reserva, para evitar race conditions y overbooking si dos usuarios reservan la misma última plaza en el mismo milisegundo.
- Calendario: Implementa las vistas de calendario tanto en web como en móvil para visualizar clases por día/semana.

### 4. Instrucciones de Generación (Agente)
- No uses librerías obsoletas ni funciones deprecated.
- Seguridad requerida: Usa Bcrypt para encriptar contraseñas. Configura CORS estrictamente en la API. Usa validación de inputs (ej. Zod o Joi) y sanitización automática del ORM para prevenir Inyecciones SQL.
- Estructura el proyecto en un monorepo (carpetas: /api, /web, /mobile).
- Proporciona todo el código necesario: Scripts SQL o migraciones de inicio de base de datos, rutas de la API, componentes UI principales, y configuración de conexión.
- Añade un archivo README.md con las instrucciones exactas para levantar los tres entornos en local y luego en un servidor de producción.

Genera el código paso a paso, asegurándote de que los endpoints de la API coincidan exactamente con las llamadas que hace el Frontend (Axios/Fetch). Comienza ahora inicializando la base de datos MySQL y la estructura de la API.