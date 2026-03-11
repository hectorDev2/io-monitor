# Sistema de Pestañas (Tabs)

## Resumen

Se ha implementado un sistema de pestañas para separar cada controlador en su propia vista, mejorando la organización y navegación de la interfaz.

## Estructura

### Pestañas Disponibles

1. **⌨️ Teclado** (`tab-keyboard`) - Controlador de Teclado i8042
   - Buffer de texto
   - Registros del controlador
   - Eventos en tiempo real

2. **🖱️ Mouse** (`tab-mouse`) - Controlador de Mouse PS/2
   - Estado del mouse
   - Registros del controlador
   - Eventos en tiempo real

3. **💿 IDE/ATA** (`tab-ide`) - Controlador IDE/ATA
   - Estadísticas de lectura/escritura
   - Registros del controlador
   - Dispositivos detectados

4. **💽 SATA** (`tab-sata`) - Controlador SATA (AHCI)
   - Estadísticas de lectura/escritura
   - Registros del controlador
   - Dispositivos detectados

5. **⚡ NVMe** (`tab-nvme`) - Controlador NVMe
   - Estadísticas de lectura/escritura
   - Registros del controlador
   - Dispositivos detectados

6. **⚡ Interrupciones** (`tab-interrupts`) - Sistema de Interrupciones
   - Tabla de IRQs
   - Puertos de E/S
   - Visualización de registros

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

### 3. `public/app.js`
- Función `initTabs()` para inicializar event listeners
- Función `switchTab(tabId)` para cambiar entre pestañas
- Redimensionamiento automático del canvas al cambiar a pestaña de interrupciones

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
