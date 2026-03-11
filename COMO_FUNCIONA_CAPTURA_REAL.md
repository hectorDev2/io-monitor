# Cómo Funciona la Captura REAL de Eventos de Hardware

## Dos Modos de Captura

### 1. Modo HARDWARE (Linux con sudo)

Cuando ejecutas la aplicación con `sudo npm start` en Linux, el sistema captura eventos **DIRECTAMENTE del hardware**:

```
Hardware → /dev/input/eventX → Aplicación → Tu pantalla
```

#### ¿Qué se captura?

**Estructura real del kernel (input_event):**
```c
struct input_event {
    struct timeval time;  // Timestamp del evento
    __u16 type;          // Tipo de evento (0x01 = tecla, 0x02 = mouse)
    __u16 code;          // Código del scan (ej: 30 = tecla 'A')
    __s32 value;         // Valor (1 = press, 0 = release)
};
```

#### Ejemplo Real

Cuando presionas la tecla **'A'**:

1. **Hardware**: El controlador de teclado (puerto 0x60) recibe el scan code `0x1E` (30 en decimal)
2. **Kernel**: Linux lee desde `/dev/input/event0` y crea un `input_event`:
   ```
   type: 0x01 (EV_KEY)
   code: 30    (tecla A)
   value: 1    (presionada)
   ```
3. **Aplicación**: Lee los 24 bytes del evento
4. **Tu pantalla**: Muestra:
   - Scan Code: `30` (0x001E)
   - Puerto: `0x60`
   - Registro: `0x1E`
   - Acción: `PRESS`

### 2. Modo NAVEGADOR (Fallback)

Cuando NO tienes permisos o estás en macOS/Windows:

```
Hardware → Sistema Operativo → Navegador → Aplicación → Tu pantalla
```

La aplicación captura eventos desde JavaScript (`keydown`, `mousemove`, etc.)

---

## Puertos y Registros Reales

### Controlador de Teclado (i8042)

| Puerto | Registro | Función |
|--------|----------|---------|
| `0x60` | Data Register | Lee/Escribe códigos de scan |
| `0x64` | Status Register | Estado del controlador |
| `0x64` | Command Register | Envía comandos |

### Códigos de Scan Reales

| Tecla | Scan Code (Dec) | Scan Code (Hex) |
|-------|-----------------|-----------------|
| A | 30 | 0x1E |
| B | 48 | 0x30 |
| ENTER | 28 | 0x1C |
| SPACE | 57 | 0x39 |
| ESC | 1 | 0x01 |

### Controlador de Mouse (PS/2)

| Código | Significado |
|--------|-------------|
| 0x00 | Movimiento en X |
| 0x01 | Movimiento en Y |
| 0x08 | Rueda del mouse |
| 272 | Click izquierdo |
| 273 | Click derecho |

---

## Cómo Verificar que es REAL

### En Linux (con sudo):

1. Ejecuta: `sudo npm start`
2. Observa el log del servidor:
   ```
   📡 Capturando eventos REALES desde: /dev/input/event3
   ```
3. En la interfaz verás:
   ```
   ✅ Modo: Captura DIRECTA del HARDWARE (/dev/input)
   ```

4. Presiona una tecla:
   - Verás el **scan code real** del hardware
   - Los valores hexadecimales son los **reales del puerto 0x60**
   - El timestamp es el del **kernel**, no del navegador

### Comparación:

**Modo Hardware:**
```
HARDWARE | PRESS | A | 30 (0x001E) | 1 (0x00000001) | 0x60 | 0x1E
```

**Modo Navegador:**
```
BROWSER | PRESS | A | 65 (0x0041) | 1 (0x00000001) | 0x60 | 0x41
```

Nota: El navegador usa **keyCodes de JavaScript** (65 para 'A'), mientras que el hardware usa **scan codes reales** (30 para 'A').

---

## Flujo Completo de un Evento

### 1. Presionas la Tecla 'A'

```
[Hardware]
Teclado detecta presión física
    ↓
Controlador envía scan code 0x1E al puerto 0x60
    ↓
Genera IRQ 1 (interrupción de teclado)
```

### 2. Kernel de Linux

```
[Kernel]
Handler de IRQ 1 se activa
    ↓
Lee el valor del puerto 0x60
    ↓
Crea input_event:
  {
    type: 0x01,    // EV_KEY
    code: 30,      // Scan code de 'A'
    value: 1       // Press
  }
    ↓
Escribe evento a /dev/input/event0
```

### 3. Nuestra Aplicación

```
[Node.js]
fs.createReadStream('/dev/input/event0')
    ↓
Lee buffer de 24 bytes
    ↓
Parsea:
  - buffer[16-17]: type = 0x01
  - buffer[18-19]: code = 30
  - buffer[20-23]: value = 1
    ↓
Envía por WebSocket al navegador
```

### 4. Interfaz

```
[Navegador]
Recibe evento por WebSocket
    ↓
Muestra en tabla:
  - Tecla: A
  - Scan Code: 30 (0x001E)
  - Puerto: 0x60
  - Registro: 0x1E
  - Acción: PRESS
    ↓
Efecto visual: Flash azul
```

---

## Comandos para Verificar en Linux

### Ver dispositivos de input:
```bash
ls -l /dev/input/
```

### Ver eventos en tiempo real (requiere sudo):
```bash
sudo cat /dev/input/event0 | hexdump -C
```

### Usar evtest (más legible):
```bash
sudo apt install evtest
sudo evtest /dev/input/event0
```

### Ver interrupciones:
```bash
watch -n 1 'cat /proc/interrupts | grep i8042'
```

---

## Diferencias entre Plataformas

| Característica | Linux + sudo | Linux sin sudo | macOS | Windows |
|---------------|--------------|----------------|-------|---------|
| Acceso a /dev/input | ✅ REAL | ❌ | ❌ | ❌ |
| Scan codes reales | ✅ | ❌ | ❌ | ❌ |
| Puertos E/S reales | ✅ | ❌ | ❌ | ❌ |
| Fallback navegador | ✅ | ✅ | ✅ | ✅ |

---

## Limitaciones

### En Linux SIN sudo:
- No puede leer `/dev/input/`
- Usa eventos del navegador
- Los scan codes son keyCodes de JavaScript

### En macOS:
- Requeriría usar IOKit con permisos especiales
- La aplicación usa fallback del navegador
- Scan codes simulados

### En Windows:
- Requeriría driver en modo kernel
- La aplicación usa fallback del navegador
- Scan codes simulados

---

## Conclusión

Para ver la **manipulación REAL de registros**:

1. **Usa Linux**
2. **Ejecuta con sudo**: `sudo npm start`
3. **Observa la etiqueta**: Debe decir `HARDWARE`, no `BROWSER`
4. **Los scan codes serán diferentes**: 30 para 'A' (hardware) vs 65 (navegador)

Si ves `BROWSER` en la etiqueta, significa que está capturando desde JavaScript, no del hardware directo.
