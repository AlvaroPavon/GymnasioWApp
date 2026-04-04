# Sistema de Gestión de Clases de Gimnasio 🏋️‍♂️

Una solución Full-Stack "Expert Level" estructurada como monorepo para la gestión avanzada e inteligente de clases de gimnasio, asegurando protección estricta de aforos y concurrencia.

## Arquitectura del Proyecto

- **`/api`**: Backend REST (Node.js, Express, Prisma ORM, JWT, MySQL InnoDB). Implementa un avanzado sistema de "Row-Level Locking" para la reserva transaccional `SELECT ... FOR UPDATE`, previniendo _race conditions_.
- **`/web`**: Panel Frontend (React.js, Vite, TailwindCSS v3). Interfaz vibrante, oscura ("Dark Mode") y con soporte de microanimaciones para Admin, Profesores y Clientes.
- **`/mobile`**: App Móvil Nativa (React Native, Expo). Preparado para compilar nativamente en iOS/Android consumiendo la misma lógica de backend de API de forma consistente.

---

## 🛠️ Requisitos Previos

1.  **Node.js 18+** instalado.
2.  Servidor **MySQL 8.0+** instalado y corriendo (Local o Remoto).
3.  **Expo CLI** (opcional, para móvil) `npm install -g expo-cli`.

---

## 🚀 Guía de Arranque Paso a Paso

### 1. Base de Datos & API Backend

1.  Dirígete a la carpeta del backend e instala dependencias:
    ```bash
    cd api
    npm install
    ```
2.  Copia la plantilla de entorno:
    ```bash
    cp .env.example .env
    ```
3.  Edita el archivo `api/.env` fijando la cadena de conexión real de tu servidor MySQL.
    ```env
    PORT=3000
    DATABASE_URL="mysql://usuario:contraseña@ip_del_servidor:3306/nombre_db"
    JWT_SECRET="tu_secreto_seguro"
    ```
4.  Realiza la **generación de base de datos** y sincronización de Prisma (esto creará las tablas si la base está vacía):
    ```bash
    npx prisma db push
    npx prisma generate
    ```
5.  Inicia el servidor backend:
    ```bash
    npm run dev
    ```
    _La API estará corriendo en http://localhost:3000._

### 2. Frontend Web (React / Tailwind)

1.  Abre una nueva terminal, ve a la carpeta web e instala todo:
    ```bash
    cd web
    npm install
    ```
2.  (Dependiendo del terminal, si hubo error, recuerda generar Tailwind: `npx tailwindcss init -p`).
3.  Inicia Vite:
    ```bash
    npm run dev
    ```
    _Se abrirá en http://localhost:5173 o similar._

### 3. Aplicación Móvil (React Native Expo)

1.  Abre otra terminal, sitúate en `/mobile` e instala dependencias. Principalmente para navegación y llamadas HTTP:
    ```bash
    cd mobile
    npm install
    npm install axios @react-native-async-storage/async-storage @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context
    ```
2.  Abre `mobile/screens/LoginScreen.js` y `DashboardScreen.js` y asegúrate de que la variable `API_URL` apunte a la IP de la máquina donde corre tu backend (por defecto tiene `10.0.2.2` que funciona en el emulador de Android local apuntando a `localhost`).
3.  Arranca la app:
    ```bash
    npx expo start
    ```
    _Escanea el QR en la app Expo Go, o pulsa `a` para Emulador Android o `i` para iOS._

---

## 🛡 Consideraciones de Seguridad (Aforo Crítico)

La reserva se gestiona con bloqueos de fila dentro de una Transacción MySQL pura.
Al hacer `/api/classes/:id/reserve`, Prisma ejecuta:
```sql
SELECT id, max_capacity FROM classes WHERE id = X FOR UPDATE;
```
Esto fuerza a otros procesos Node.js a esperar, de manera que la sobrecapacidad (overbooking) en el mismo milisegundo de peticiones HTTP concurrentes es matemáticamente imposible en el motor InnoDB.
