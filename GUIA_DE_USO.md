# 🚀 GUÍA DE USO - CONTROLADORES SEPARADOS

## ✨ ¿Qué Hay de Nuevo?

La aplicación ahora tiene **dos secciones completamente independientes**:
1. **Controlador de Teclado (i8042)** - Color azul
2. **Controlador de Mouse (PS/2)** - Color verde

Cada sección muestra:
- Sus propios registros (Data, Status, Command, Control)
- Su tabla de eventos separada
- Información específica del dispositivo
- Estado en tiempo real

## 🎯 Cómo Usar

### 1. Iniciar la Aplicación

#### En Linux (Captura REAL de hardware):
```bash
cd io-monitor
sudo npm start
```

#### En macOS/Windows (Captura desde navegador):
```bash
cd io-monitor
npm start
```

### 2. Abrir en el Navegador

```
http://localhost:3000
```

### 3. Interactuar con el Teclado

**Scroll a la sección AZUL (Controlador de Teclado)**

1. **Escribe algo** en tu teclado
2. **Observa**:
   - ✍️ **Buffer de Texto**: Se actualiza con lo que escribes
   - 🔧 **Registros**: Muestran los códigos de scan (ej: 0x1E para "A")
   - ⚡ **Tabla de Eventos**: Lista cada tecla presionada/soltada
   - 🚨 **Flag IRQ1**: Se ilumina al presionar teclas

**Ejemplo**:
```
Presionas: H → e → l → l → o

Buffer muestra: Hello
Data Register: 0x23 (scan code de 'H')
Status Register: OBF ✓ (hay datos disponibles)
Control Register: IRQ1 ✓ (interrupción activa)

Tabla de eventos:
14:32:15.234 | PRESS   | H | 35 (0x23) | ...
14:32:15.456 | RELEASE | H | 35 (0x23) | ...
14:32:15.678 | PRESS   | E | 18 (0x12) | ...
...
```

### 4. Interactuar con el Mouse

**Scroll a la sección VERDE (Controlador de Mouse)**

1. **Mueve el mouse** sobre la ventana del navegador
2. **Haz clicks** (izquierdo, derecho, medio)
3. **Observa**:
   - 📊 **Estadísticas**: Posición X/Y, contador de movimientos, clicks
   - 🔧 **Registros**: Muestran datos del mouse (movimientos, botones)
   - ⚡ **Tabla de Eventos**: Lista movimientos y clicks
   - 🚨 **Flag IRQ12**: Se ilumina al mover/clickear

**Ejemplo**:
```
Mueves mouse 5px a la derecha:

Posición X: 542 → 547
Movimientos: 1247 → 1248
Data Register: 0x05 (delta X = +5)
Status Register: OBF ✓, AUX ✓ (datos de mouse disponibles)
Control Register: IRQ12 ✓ (interrupción activa)

Tabla de eventos:
14:33:20.123 | MOVE | X | +5 | ...
```

## 🎨 Identificación Visual

### Colores
- **Azul brillante (`#00d9ff`)** = Todo relacionado con TECLADO
- **Verde brillante (`#00ff88`)** = Todo relacionado con MOUSE

### Iconos
- ⌨️ = Teclado
- 🖱️ = Mouse
- 🔧 = Registros
- ⚡ = Eventos en tiempo real
- ✍️ = Buffer de texto
- 📊 = Estadísticas

### Badges de Estado
```
[Puerto 0x60/0x64] - Puerto de E/S
[IRQ 1]  - Interrupción de teclado
[IRQ 12] - Interrupción de mouse
[Estado: Activo] - Verde cuando hay actividad
[Estado: Esperando] - Gris cuando sin actividad
```

## 📊 Registros Explicados

### Data Register (Puerto 0x60)
- **Teclado**: Lee códigos de scan (30 = 'A', 57 = 'SPACE')
- **Mouse**: Lee paquetes de datos (3-4 bytes por movimiento/click)

### Status Register (Puerto 0x64 - Lectura)
- **OBF (Output Buffer Full)**: Hay datos listos para leer
- **IBF (Input Buffer Full)**: El buffer de entrada está lleno
- **AUX**: Indica que los datos son del mouse (no teclado)

### Command Register (Puerto 0x64 - Escritura)
- **Teclado**: 0x20 = Leer byte de configuración
- **Mouse**: 0xD4 = Escribir al mouse

### Control Register (Configuración Interna)
- **IRQ1**: Interrupciones del teclado habilitadas
- **IRQ12**: Interrupciones del mouse habilitadas

## 🔍 Modo de Captura

### Hardware Mode ✅ (Linux con sudo)
```
✅ Modo: Captura DIRECTA del HARDWARE (/dev/input)

- Lee eventos directamente desde /dev/input/eventX
- Códigos de scan REALES del hardware
- Timestamps precisos del kernel
- Etiqueta: [HARDWARE]
```

### Browser Mode 📝 (Sin sudo / macOS / Windows)
```
📝 Modo: Captura desde NAVEGADOR

- Lee eventos desde JavaScript del navegador
- Códigos de teclado de JavaScript (no scan codes reales)
- Timestamps del sistema
- Etiqueta: [BROWSER]
```

## 💡 Tips y Trucos

### Ver la Diferencia entre Controladores
1. Presiona una tecla → Ve IRQ1 activarse en teclado
2. Mueve el mouse → Ve IRQ12 activarse en mouse
3. Compara los valores de los registros

### Experimentar con Teclas Especiales
- **BACKSPACE**: Borra del buffer de texto
- **ENTER**: Agrega nueva línea
- **SPACE**: Agrega espacio
- **Shift, Ctrl, Alt**: Muestran códigos de scan especiales

### Ver Movimientos del Mouse en Detalle
- **Movimientos lentos**: Ve cada eje (X/Y) por separado
- **Clicks rápidos**: Ve eventos PRESS → RELEASE
- **Scroll** (si disponible): Ve eventos WHEEL

### Limpiar y Reiniciar
- **Botón "Limpiar Buffer"**: Borra el texto escrito
- **Refresca la página**: Reinicia todos los contadores
- **Reconecta**: Si pierdes conexión, espera 3 segundos para reconectar

## 🐛 Solución de Problemas

### "No veo eventos"
- ✅ Verifica que la página esté enfocada (haz click en ella)
- ✅ Verifica conexión WebSocket en el header (debe estar verde)
- ✅ Abre consola del navegador (F12) para ver errores

### "Dice BROWSER en lugar de HARDWARE"
- ⚠️ Necesitas ejecutar con `sudo npm start` en Linux
- ℹ️ En macOS/Windows siempre será BROWSER mode

### "Los registros no se actualizan"
- 🔄 Refresca la página (Ctrl+R / Cmd+R)
- 🔌 Verifica que el servidor esté corriendo

### "Veo valores extraños en los registros"
- ℹ️ Los valores hexadecimales son normales (0x1E, 0x39, etc.)
- ℹ️ Los valores binarios muestran los bits individuales

## 📚 Aprendizaje

### Conceptos Clave para Entender

1. **i8042**: Controlador único que maneja teclado Y mouse
2. **Puertos compartidos**: Ambos usan 0x60 y 0x64
3. **IRQs diferentes**: El sistema sabe distinguir por IRQ1 vs IRQ12
4. **Scan codes**: Códigos únicos de hardware (no ASCII)
5. **Paquetes PS/2**: Mouse envía 3-4 bytes por evento

### Ejercicios

1. **Ejercicio 1**: Presiona 'A' y observa:
   - ¿Qué código de scan tiene?
   - ¿Cuánto tiempo entre PRESS y RELEASE?

2. **Ejercicio 2**: Mueve el mouse en línea recta:
   - ¿Solo eje X o Y se actualiza?
   - ¿Cuántos eventos por segundo?

3. **Ejercicio 3**: Presiona teclas y mueve el mouse simultáneamente:
   - ¿Ambos IRQ se activan?
   - ¿Los registros se actualizan correctamente?

## 🎓 Valor Educativo

Esta interfaz te ayuda a entender:

✅ Cómo funcionan los controladores PS/2  
✅ La diferencia entre teclado y mouse a nivel de hardware  
✅ Qué son los scan codes y cómo se procesan  
✅ Cómo el sistema operativo maneja interrupciones  
✅ La arquitectura de puertos de E/S (0x60, 0x64)  

## 📞 Soporte

Si encuentras problemas o tienes preguntas:

1. Revisa la consola del navegador (F12)
2. Revisa la consola del servidor (terminal)
3. Lee los archivos .md en el proyecto:
   - `README.md` - Documentación completa
   - `QUICK_START.md` - Inicio rápido
   - `SEPARACION_CONTROLADORES.md` - Detalles técnicos
   - `BUGFIX_TIMESTAMP.md` - Corrección de bugs

## 🚀 Próximos Pasos

Después de familiarizarte con la interfaz:

1. Explora el código fuente en `public/app.js`
2. Examina cómo se capturan eventos en `src/monitors/realtime-input.js`
3. Prueba en Linux con `sudo` para ver eventos reales de hardware
4. Experimenta modificando los estilos en `public/styles.css`

---

**¡Disfruta explorando el hardware de tu computadora!** 🎉
