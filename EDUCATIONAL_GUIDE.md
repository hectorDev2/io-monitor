# Guía Educativa: Entendiendo E/S y Registros del Sistema

## Tabla de Contenidos
1. [Conceptos Básicos](#conceptos-básicos)
2. [Interrupciones (IRQs)](#interrupciones-irqs)
3. [Operaciones de E/S](#operaciones-de-es)
4. [Ejercicios Prácticos](#ejercicios-prácticos)

---

## Conceptos Básicos

### ¿Qué son los Registros de E/S?

Los registros de E/S (Input/Output) son ubicaciones especiales de memoria que permiten al procesador comunicarse con dispositivos de hardware como:
- Teclado
- Mouse
- Disco duro
- Tarjeta de red
- Pantalla

### ¿Por qué son importantes?

Entender cómo funcionan los registros de E/S es fundamental para:
- Desarrollo de drivers
- Optimización de rendimiento
- Debugging de hardware
- Comprensión de la arquitectura del sistema

---

## Interrupciones (IRQs)

### ¿Qué es una Interrupción?

Una interrupción (IRQ - Interrupt Request) es una señal enviada al procesador por un dispositivo de hardware para indicar que necesita atención.

### Tipos de Interrupciones Comunes

| IRQ | Dispositivo Típico | Propósito |
|-----|-------------------|-----------|
| 1   | Teclado           | Tecla presionada |
| 12  | Mouse PS/2        | Movimiento o click |
| 14  | Controlador IDE   | Operación de disco completa |
| 16+ | PCI Devices       | Varios dispositivos modernos |

### Observando Interrupciones en la Aplicación

1. **Abre la aplicación** en tu navegador
2. **Observa la sección "Interrupciones (IRQs)"**
3. **Interactúa con tu sistema**:
   - Presiona teclas → Verás incrementos en IRQ 1
   - Mueve el mouse → Verás actividad en IRQ 12
   - Accede a archivos → Verás actividad en el controlador de disco

### Ejercicio 1: Identificar Interrupciones del Teclado

```
1. Inicia la aplicación
2. Observa la columna "Delta" en la tabla de interrupciones
3. Presiona repetidamente una tecla
4. ¿Qué IRQ muestra mayor actividad?
5. ¿Cuál es el nombre del dispositivo asociado?
```

**Respuesta esperada**: Deberías ver actividad en IRQ 1 (i8042 Keyboard) con valores positivos en la columna Delta.

---

## Operaciones de E/S

### Lectura vs Escritura

- **Lectura**: El CPU lee datos desde un dispositivo (ej: leer un archivo del disco)
- **Escritura**: El CPU envía datos a un dispositivo (ej: guardar un archivo)

### Estadísticas de E/S en la Aplicación

La sección "Estadísticas de E/S" muestra:
- **Lecturas**: Número total de operaciones de lectura
- **Escrituras**: Número total de operaciones de escritura
- **Bytes leídos/escritos**: Volumen de datos transferidos
- **Delta**: Cambios desde la última actualización

### Ejercicio 2: Generar Actividad de E/S

```bash
# En una terminal, ejecuta:

# Generar lecturas
dd if=/dev/zero of=/tmp/test.dat bs=1M count=100

# Observa el incremento en "Lecturas" y "Escrituras" en la aplicación
```

---

## Puertos de E/S (Linux)

### ¿Qué son los Puertos de E/S?

Los puertos de E/S son direcciones especiales que mapean dispositivos de hardware. En arquitectura x86, se usan direcciones como:
- `0x3F8-0x3FF`: Puerto serial COM1
- `0x60-0x64`: Controlador de teclado PS/2
- `0x1F0-0x1F7`: Controlador IDE primario

### Visualización en la Aplicación

En Linux (ejecutando con `sudo`), la sección "Puertos de E/S" muestra el mapeo real de `/proc/ioports`.

---

## Ejercicios Prácticos

### Ejercicio 3: Medir Latencia de Interrupciones

**Objetivo**: Observar la rapidez con que el sistema responde a interrupciones.

1. Observa la columna "Delta" en interrupciones
2. Realiza acciones rápidas (ej: teclear rápidamente)
3. Observa qué tan rápido se actualizan los valores

**Pregunta**: ¿Cuántas interrupciones genera tu teclado por segundo al escribir?

### Ejercicio 4: Comparar Dispositivos

**Objetivo**: Entender qué dispositivos son más activos.

1. Deja la aplicación corriendo durante 1 minuto
2. Anota los 5 dispositivos con mayor valor en "Total"
3. Identifica qué dispositivos generan más interrupciones

**Preguntas**:
- ¿Qué dispositivo es el más activo?
- ¿Por qué crees que genera tantas interrupciones?

### Ejercicio 5: Entender la Actividad del Disco

**Objetivo**: Visualizar cómo el sistema operativo accede al disco.

```bash
# Genera actividad de disco
while true; do
  ls -R / > /dev/null 2>&1
done
```

**Observa**:
- Incremento en "Escrituras" y "Lecturas"
- Actividad en el IRQ del controlador SATA/NVMe
- Cambios en "Bytes leídos/escritos"

---

## Conceptos Avanzados

### DMA (Direct Memory Access)

Algunos dispositivos modernos usan DMA para transferir datos directamente a memoria sin involucrar al CPU constantemente. Esto reduce las interrupciones pero hace que el monitoreo sea más complejo.

### MSI/MSI-X (Message Signaled Interrupts)

Los dispositivos PCI Express modernos usan MSI en lugar de IRQs tradicionales. Estos aparecen con números de IRQ más altos (>16).

### Polling vs Interrupciones

- **Polling**: El CPU pregunta constantemente "¿hay datos?"
- **Interrupciones**: El dispositivo avisa "¡tengo datos!"

Las interrupciones son más eficientes, pero algunos dispositivos de alta velocidad usan polling para reducir overhead.

---

## Preguntas de Repaso

1. **¿Qué es una interrupción y por qué es necesaria?**
2. **¿Qué diferencia hay entre lectura y escritura en términos de E/S?**
3. **¿Por qué algunos dispositivos generan más interrupciones que otros?**
4. **¿Qué significa cuando el "Delta" de una interrupción es 0?**
5. **¿Cómo afecta el uso de DMA a las estadísticas de interrupciones?**

---

## Recursos Adicionales

- [OSDev Wiki - Interrupts](https://wiki.osdev.org/Interrupts)
- [Linux Kernel Documentation](https://www.kernel.org/doc/html/latest/)
- [x86 Architecture - I/O Ports](https://wiki.osdev.org/I/O_Ports)
- [Understanding the Linux Kernel](https://www.oreilly.com/library/view/understanding-the-linux/0596005652/)

---

## Proyectos Sugeridos

1. **Crear un driver simple**: Implementa un driver básico que genere interrupciones personalizadas
2. **Benchmark de E/S**: Mide el rendimiento de diferentes operaciones de E/S
3. **Monitor de rendimiento**: Extiende esta aplicación para incluir métricas de CPU y memoria
4. **Visualización 3D**: Crea una visualización 3D de la actividad del sistema

---

**Nota**: Esta aplicación es una herramienta educativa. Para desarrollo real de drivers, consulta la documentación oficial de tu sistema operativo.
