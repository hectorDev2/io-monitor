# Sistema de Pestañas (Tabs)

## Resumen

Se ha implementado un sistema de pestañas para separar cada controlador en su propia vista, mejorando la organización y navegación de la interfaz. El sistema incluye simuladores interactivos para enviar comandos a los controladores.

## Estructura

### Pestañas Disponibles

1. **⌨️ Teclado** (`tab-keyboard`) - Controlador de Teclado i8042
   - Explicación del controlador i8042
   - Buffer de texto interactivo
   - Registros del controlador
   - **Simulador de comandos** - Envía comandos al controlador
   - Eventos en tiempo real

2. **🖱️ Mouse** (`tab-mouse`) - Controlador de Mouse PS/2
   - Explicación del protocolo PS/2
   - Estado del mouse
   - Registros del controlador
   - **Simulador de comandos** - Envía comandos al mouse
   - Eventos en tiempo real

3. **🔄 DMA** (`tab-dma`) - Controlador DMA (Direct Memory Access)
   - Explicación de DMA
   - 8 canales DMA (0-7) con estado
   - Registros DMA
   - Tabla de transferencias en tiempo real

4. **⚡ Interrupciones** (`tab-interrupts`) - Sistema de Interrupciones
   - Explicación de IRQs
   - Tabla de interrupciones
   - Puertos de E/S
   - Visualización de registros

### Pestañas Eliminadas (no funcionan en macOS)
- ~~💿 IDE/ATA~~ - Eliminado (no disponible en macOS)
- ~~💽 SATA~~ - Eliminado (no disponible en macOS)
- ~~⚡ NVMe~~ - Eliminado (no disponible en macOS)

## Archivos Modificados

### 1. `public/index.html`
- Agregado `<div class="tabs-container">` con header de pestañas
- Cada sección envuelta en `<div class="tab-pane" id="tab-X">`
- Primera pestaña (Teclado) marcada como `active`

### 2. `public/styles.css`
- Agregados estilos para `.tabs-container`, `.tabs-header`, `.tab-button`
- Estilos específicos para cada pestaña con colores distintivos
- Animación `fadeIn` para transiciones suaves
- Responsive design para dispositivos móviles
- **Nuevos estilos para simuladores**: `.simulator-panel`, `.simulator-controls`, `.simulator-button`, `.simulator-output`
- Estilos para entradas de comandos y respuestas simuladas

### 3. `public/app.js`
- Función `initTabs()` para inicializar event listeners
- Función `switchTab(tabId)` para cambiar entre pestañas
- Redimensionamiento automático del canvas al cambiar a pestaña de interrupciones
- **Nuevas funciones de simulación**:
  - `initKeyboardSimulator()` - Inicializa el simulador del teclado
  - `simulateKeyboardCommand()` - Simula comandos al controlador i8042
  - `initMouseSimulator()` - Inicializa el simulador del mouse
  - `simulateMouseCommand()` - Simula comandos al mouse PS/2
  - `simulateDMATransfer()` - Genera transferencias DMA simuladas
  - `startDMASimulation()` - Inicia la simulación periódica de DMA
  - `generateSimulatedInterrupts()` - Genera datos simulados de interrupciones para macOS

## Uso

### Para el Usuario
- Haz clic en cualquier botón de pestaña en la parte superior para cambiar de vista
- La pestaña activa se muestra con un borde inferior de color
- Solo se muestra el contenido de la pestaña activa

### Para Desarrolladores

#### Agregar una nueva pestaña:

1. **En `index.html`** - Agregar botón en `.tabs-header`:
```html
<button class="tab-button" data-tab="nuevo-controlador">
    <span class="tab-icon">🔧</span>
    <span class="tab-label">Nuevo</span>
</button>
```

2. **En `index.html`** - Agregar contenido en `.tabs-content`:
```html
<div class="tab-pane" id="tab-nuevo-controlador">
    <!-- Contenido del controlador -->
</div>
```

3. **En `styles.css`** - Agregar estilo para el color activo (opcional):
```css
.tab-button[data-tab="nuevo-controlador"].active {
    color: #YOUR_COLOR;
    border-bottom-color: #YOUR_COLOR;
}
```

## Características

- ✅ **Navegación intuitiva** - Cambio rápido entre controladores
- ✅ **Performance** - Solo se renderiza la pestaña activa
- ✅ **Responsive** - Adaptado para dispositivos móviles
- ✅ **Animaciones suaves** - Transiciones visuales agradables
- ✅ **Colores distintivos** - Cada controlador tiene su propio color
- ✅ **Persistencia** - La primera pestaña se carga por defecto

## Colores de Pestañas

- Teclado: `#00d9ff` (cyan)
- Mouse: `#00ff88` (verde)
- IDE/ATA: `#ff8800` (naranja)
- SATA: `#aa44ff` (púrpura)
- NVMe: `#ffcc00` (amarillo)
- Interrupciones: `#ffd93d` (amarillo dorado)

## Notas Técnicas

- El sistema usa clases CSS para mostrar/ocultar contenido (`.active`)
- JavaScript maneja los eventos de clic y actualiza las clases
- No hay recarga de página al cambiar de pestaña
- El canvas de visualización se redimensiona automáticamente al entrar a la pestaña de interrupciones
