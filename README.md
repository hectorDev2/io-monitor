# Monitor REAL de E/S y Registros del Sistema (Solo Linux)

Una aplicación que captura y visualiza **eventos REALES del hardware** en tiempo real, mostrando códigos de scan, valores de registros y puertos de E/S exactamente como el sistema operativo los manipula.

**IMPORTANTE:** Esta aplicación solo funciona completamente en **Linux con permisos de root**. No hay simulaciones ni datos falsos.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20Only-red.svg)

## Características Principales

### 🎯 Captura REAL de Eventos del Hardware
- **Lee directamente de `/dev/input`** en Linux con sudo
- Muestra **scan codes reales** del hardware (no keyCodes del navegador)
- Visualiza **valores exactos de registros** (puertos 0x60, 0x64)
- Captura eventos **directamente del kernel**

### ⚡ Visualización en Tiempo Real
- **Cada tecla presionada** aparece instantáneamente con sus valores hexadecimales
- **Cada movimiento del mouse** muestra los valores del controlador PS/2
- **Códigos de scan reales** del hardware (ej: 30 para 'A')
- **Flash visual** cuando se escribe en los registros

### 📊 Información Detallada
- **Monitoreo de Interrupciones (IRQs)**: IRQ 1 (teclado), IRQ 12 (mouse), etc.
- **Estadísticas de E/S**: Lecturas/escrituras de disco en tiempo real
- **Puertos de E/S**: Visualiza rangos de puertos (0x60-0x64, etc.)
- **Registros del controlador**: Valores exactos escritos en el hardware

## ¿Por Qué Esta Aplicación es Diferente?

**❌ Otras herramientas simulan** o capturan desde el navegador

**✅ Esta aplicación captura DIRECTAMENTE del hardware** (solo Linux con sudo)

```
Hardware → /dev/input → Esta App → Tu Pantalla
   (REAL)              (REAL)      (REAL)
```

## Requisitos Previos

- **Sistema Operativo:** Linux (Ubuntu, Debian, Fedora, Arch, etc.)
- **Permisos:** Root (sudo)
- Node.js >= 14.0.0
- npm o yarn

**NOTA:** macOS y Windows NO están soportados. Esta aplicación requiere acceso directo a `/proc/interrupts`, `/proc/diskstats`, `/proc/ioports` y `/dev/input`, que solo están disponibles en Linux.

## Instalación

1. Navega al directorio del proyecto:
```bash
cd io-monitor
```

2. Instala las dependencias:
```bash
npm install
```

## Uso

### 🚀 Inicio con Captura REAL (Linux - REQUERIDO)

**IMPORTANTE: Solo funciona en Linux con sudo**

```bash
sudo npm start
```

**Abre `http://localhost:3000` y:**
1. Presiona cualquier tecla
2. Observa cómo aparece **instantáneamente** con:
   - Scan code REAL (ej: 30 para 'A')
   - Valor del puerto `0x60` en hexadecimal
   - Tipo de evento `EV_KEY (0x01)`
   - Etiqueta `HARDWARE` (captura real del kernel)

### Modo Desarrollo

```bash
sudo npm run dev
```

Usa `nodemon` para reiniciar automáticamente el servidor cuando detecte cambios.

**NOTA:** Si ejecutas sin `sudo`, el servidor iniciará pero no podrá acceder a `/dev/input`, `/proc/interrupts`, etc. Solo funciona completamente con permisos de root.

## Arquitectura

```
io-monitor/
├── src/
│   ├── server.js              # Servidor Express + WebSocket
│   └── monitors/
│       ├── interrupts.js      # Monitor de interrupciones (IRQs)
│       └── io.js              # Monitor de E/S y dispositivos
├── public/
│   ├── index.html             # Interfaz principal
│   ├── app.js                 # Lógica del cliente y WebSocket
│   └── styles.css             # Estilos de la aplicación
└── package.json
```

## Funcionalidades (Solo Linux)

### Linux (Completamente Soportado)
- **Acceso completo** a `/proc/interrupts` para IRQs reales
- Lee `/proc/diskstats` para estadísticas de E/S
- Acceso a `/proc/ioports` para rangos de puertos
- Lista y lee dispositivos de input en `/dev/input`
- **Requiere sudo para acceso completo**

### macOS y Windows
- **NO SOPORTADOS**
- No hay acceso a interrupciones del sistema
- No hay acceso a dispositivos de entrada de bajo nivel
- No hay simulación de datos - solo funciona con datos reales en Linux

## API del Servidor

### HTTP Endpoints

#### GET /api/system-info
Retorna información del sistema:
```json
{
  "platform": "linux",
  "arch": "x64",
  "cpus": 8,
  "hostname": "server-name",
  "totalMemory": 16777216000,
  "freeMemory": 8388608000
}
```

### WebSocket

Conexión: `ws://localhost:3000`

**Mensajes del servidor**:
```json
{
  "type": "update",
  "timestamp": 1678901234567,
  "data": {
    "interrupts": {
      "interrupts": [...],
      "platform": "linux"
    },
    "io": {
      "devices": [...],
      "platform": "linux"
    },
    "input": {
      "keyboard": {...},
      "mouse": {...}
    },
    "ports": {
      "ports": [...]
    }
  }
}
```

## Estructura de Datos

### Interrupción (IRQ)
```javascript
{
  irq: "1",
  count: 123456,
  delta: 5,
  device: "i8042 (Keyboard)",
  type: "keyboard"
}
```

### Dispositivo de E/S
```javascript
{
  name: "sda",
  type: "disk",
  reads: 50000,
  writes: 30000,
  readBytes: 1024000000,
  writeBytes: 512000000,
  readsDelta: 10,
  writesDelta: 5,
  active: true
}
```

## Casos de Uso Educativos

Esta aplicación es ideal para:

1. **Cursos de Sistemas Operativos**: Visualizar conceptos de interrupciones, E/S y gestión de dispositivos
2. **Debugging de Hardware**: Identificar qué dispositivos están generando interrupciones
3. **Optimización de Rendimiento**: Monitorear carga de E/S en discos
4. **Aprendizaje de Arquitectura de Computadores**: Entender cómo el hardware se comunica con el SO

## Limitaciones

- **Sistema Operativo**: Solo funciona en Linux. macOS y Windows no están soportados.
- **Permisos**: Se requieren privilegios de root (sudo) para acceso completo a registros del sistema
- **Seguridad**: Esta aplicación lee información del sistema pero no modifica ningún registro
- **Sin Simulación**: No hay datos simulados ni falsos. Todo es captura real del hardware.

## Desarrollo

### Agregar Nuevos Monitores

Crea un nuevo archivo en `src/monitors/`:

```javascript
class CustomMonitor {
  constructor() {
    // Inicialización
  }

  async getData() {
    // Lógica de captura de datos
    return { data: [...] };
  }
}

module.exports = CustomMonitor;
```

Luego intégralo en `src/server.js`:

```javascript
const CustomMonitor = require('./monitors/custom');
const customMonitor = new CustomMonitor();

// En el callback de WebSocket
const customData = await customMonitor.getData();
```

## Troubleshooting

### Error: "Cannot read /proc/interrupts"
**Solución**: Ejecuta con `sudo npm start` en Linux

### Error: "EADDRINUSE: address already in use"
**Solución**: El puerto 3000 está ocupado. Cambia el puerto:
```bash
PORT=3001 npm start
```

### Los datos no se actualizan
**Solución**: Verifica que el WebSocket esté conectado (indicador verde en la interfaz)

## Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## Licencia

MIT License - Ver archivo LICENSE para más detalles

## Autor

Creado como herramienta educativa para la comprensión de sistemas operativos y arquitectura de computadores

## Referencias

- [Linux Kernel Documentation - Interrupts](https://www.kernel.org/doc/html/latest/)
- [/proc filesystem](https://man7.org/linux/man-pages/man5/proc.5.html)
- [I/O and Device Management](https://wiki.osdev.org/I/O)

---

**Nota**: Esta aplicación es para propósitos educativos. No modifica ningún registro del sistema, solo lee información disponible.
