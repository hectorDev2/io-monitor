# 🚀 Inicio Rápido - Ver Eventos REALES Ahora Mismo

## En 3 Pasos

### 1️⃣ Instala las dependencias
```bash
cd io-monitor
npm install
```

### 2️⃣ Inicia el servidor

**En Linux (para captura REAL del hardware):**
```bash
sudo npm start
```

**En macOS/Windows o Linux sin sudo:**
```bash
npm start
```

### 3️⃣ Abre tu navegador
```
http://localhost:3000
```

---

## ✨ Qué Verás

### Panel "Eventos REALES de Hardware"

Este panel muestra **cada tecla que presiones** en tiempo real.

#### Presiona la tecla 'A':

Verás algo como esto:

| Tiempo | Dispositivo | Acción | Tecla | Scan Code | Valor | Puerto | Registro |
|--------|-------------|--------|-------|-----------|-------|--------|----------|
| 05:23:15.234 | ⌨️ keyboard `HARDWARE` | PRESS | **A** | `30` (0x001E) | 1 (0x00000001) | `0x60` | `0x1E` |

**¿Qué significa cada columna?**

- **Tiempo**: Timestamp exacto del evento
- **Dispositivo**: Teclado o mouse + etiqueta de origen
  - `HARDWARE` = captura REAL desde /dev/input 🎯
  - `BROWSER` = captura desde JavaScript (fallback)
- **Acción**: PRESS (presionar) o RELEASE (soltar)
- **Tecla**: La tecla que presionaste
- **Scan Code**: Código real del hardware
  - En modo HARDWARE: scan code real (30 para 'A')
  - En modo BROWSER: keyCode de JS (65 para 'A')
- **Valor**: Estado de la tecla (1 = presionada, 0 = soltada)
- **Puerto**: Puerto de E/S del controlador (0x60 = Data Register)
- **Registro**: Valor exacto escrito en el puerto

---

## 🎮 Prueba Estos Ejemplos

### Ejemplo 1: Ver scan codes del teclado

1. Abre la aplicación
2. Presiona estas teclas en orden: **A, S, D, F**
3. Observa los scan codes:
   - A = 30 (0x1E)
   - S = 31 (0x1F)
   - D = 32 (0x20)
   - F = 33 (0x21)

### Ejemplo 2: Ver eventos del mouse

1. Mueve el mouse rápidamente
2. Observa eventos de tipo `EV_REL` con eje X e Y
3. Los valores positivos = derecha/abajo
4. Los valores negativos = izquierda/arriba

### Ejemplo 3: Identificar IRQs

1. Mira la sección "Interrupciones (IRQs)"
2. Presiona teclas repetidamente
3. Observa cómo incrementa el contador del **IRQ 1** (teclado)
4. Mueve el mouse
5. Observa cómo incrementa el contador del **IRQ 12** (mouse)

---

## 🔍 Cómo Saber si Estás en Modo REAL

### ✅ Modo HARDWARE (Captura Real)

Si ves esto, estás capturando DIRECTAMENTE del hardware:

```
✅ Modo: Captura DIRECTA del HARDWARE (/dev/input)
```

Y en cada evento verás la etiqueta verde:
```
⌨️ keyboard HARDWARE
```

Los scan codes serán los reales del hardware (30 para 'A').

### ⚠️ Modo BROWSER (Fallback)

Si ves esto, estás capturando desde JavaScript:

```
📝 Modo: Captura desde NAVEGADOR (ejecuta con sudo en Linux para acceso real al hardware)
```

Y en cada evento verás la etiqueta amarilla:
```
⌨️ keyboard BROWSER
```

Los scan codes serán keyCodes de JavaScript (65 para 'A').

**Para cambiar a modo REAL:**
1. Cierra el servidor (Ctrl+C)
2. Ejecuta: `sudo npm start`
3. Recarga el navegador

---

## 📚 Más Información

- **README.md**: Documentación completa
- **COMO_FUNCIONA_CAPTURA_REAL.md**: Explicación técnica detallada
- **EDUCATIONAL_GUIDE.md**: Guía educativa con ejercicios

---

## 🐛 Problemas Comunes

### No veo la etiqueta "HARDWARE"

**Solución**: Ejecuta con sudo en Linux
```bash
sudo npm start
```

### "Cannot read /dev/input"

**Solución**: Necesitas permisos de root
```bash
sudo npm start
```

### El puerto 3000 está ocupado

**Solución**: Usa otro puerto
```bash
PORT=8080 npm start
```

---

## 🎯 Lo Más Importante

1. **En Linux con sudo**: Captura REAL del hardware
2. **Sin sudo**: Captura desde el navegador (simulada)
3. **Busca la etiqueta verde "HARDWARE"** para confirmar captura real
4. **Los scan codes reales son diferentes** a los keyCodes de JavaScript

Presiona **cualquier tecla** y observa cómo se manipulan los registros en tiempo real!
