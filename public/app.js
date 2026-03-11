// Conexión WebSocket
let ws;
let reconnectTimeout;

// Datos históricos para visualización
const interruptHistory = {};
const maxHistoryLength = 60; // 60 segundos de historial

// Conectar al WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('Conectado al servidor');
        updateConnectionStatus(true);
    };
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'update') {
            updateUI(message.data);
            updateLastUpdateTime();
        } else if (message.type === 'realtime-event') {
            // Evento en tiempo real del hardware
            handleRealtimeEvent(message.event);
        } else if (message.type === 'error') {
            console.error('Error del servidor:', message.message);
        }
    };
    
    ws.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        updateConnectionStatus(false);
    };
    
    ws.onclose = () => {
        console.log('Desconectado del servidor');
        updateConnectionStatus(false);
        
        // Intentar reconectar después de 3 segundos
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
    };
}

// Actualizar estado de conexión
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    const dot = statusEl.querySelector('.status-dot');
    
    if (connected) {
        dot.className = 'status-dot connected';
        statusEl.innerHTML = '<span class="status-dot connected"></span> Conectado';
    } else {
        dot.className = 'status-dot disconnected';
        statusEl.innerHTML = '<span class="status-dot disconnected"></span> Desconectado';
    }
}

// Actualizar toda la interfaz
function updateUI(data) {
    if (data.interrupts) {
        updateInterruptsTable(data.interrupts);
        updatePlatformNote(data.interrupts.note || data.interrupts.error);
    }
    
    if (data.io) {
        updateIODevices(data.io);
    }
    
    if (data.input) {
        updateInputEvents(data.input);
    }
    
    if (data.ports && data.ports.ports && data.ports.ports.length > 0) {
        updateIOPorts(data.ports);
    }
    
    // Actualizar visualización de registros
    updateRegistersVisualization(data);
}

// Actualizar tabla de interrupciones
function updateInterruptsTable(interruptsData) {
    const tbody = document.getElementById('interruptsBody');
    
    if (interruptsData.error) {
        tbody.innerHTML = `<tr><td colspan="6" class="error">${interruptsData.error}</td></tr>`;
        return;
    }
    
    if (!interruptsData.interrupts || interruptsData.interrupts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No hay datos de interrupciones disponibles</td></tr>';
        return;
    }
    
    // Filtrar y ordenar por delta (actividad reciente)
    const interrupts = interruptsData.interrupts
        .filter(irq => irq.delta > 0 || ['keyboard', 'mouse', 'disk', 'network'].includes(irq.type))
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 20); // Mostrar solo los 20 más activos
    
    tbody.innerHTML = interrupts.map(irq => {
        const activityClass = irq.delta > 0 ? 'active' : 'inactive';
        const activityBar = irq.delta > 0 ? getActivityBar(irq.delta) : '';
        
        // Guardar historial
        if (!interruptHistory[irq.irq]) {
            interruptHistory[irq.irq] = [];
        }
        interruptHistory[irq.irq].push(irq.delta);
        if (interruptHistory[irq.irq].length > maxHistoryLength) {
            interruptHistory[irq.irq].shift();
        }
        
        return `
            <tr class="${activityClass}">
                <td><strong>${irq.irq}</strong></td>
                <td>${escapeHtml(irq.device)}</td>
                <td><span class="badge ${irq.type}">${irq.type}</span></td>
                <td>${formatNumber(irq.count)}</td>
                <td class="delta">${irq.delta > 0 ? '+' : ''}${formatNumber(irq.delta)}</td>
                <td class="activity-cell">${activityBar}</td>
            </tr>
        `;
    }).join('');
}

// Generar barra de actividad
function getActivityBar(delta) {
    const maxWidth = 100;
    const width = Math.min(delta * 2, maxWidth);
    return `<div class="activity-bar" style="width: ${width}%"></div>`;
}

// ========================================
// ACTUALIZACIÓN DE CONTROLADORES DE DISCO
// ========================================

/**
 * Actualiza las estadísticas de todos los controladores de disco
 */
function updateIODevices(ioData) {
    if (ioData.error || !ioData.devices || ioData.devices.length === 0) {
        return;
    }
    
    // Clasificar dispositivos por tipo de controlador
    const ideDevices = [];
    const sataDevices = [];
    const nvmeDevices = [];
    
    ioData.devices.forEach(device => {
        const name = device.name.toLowerCase();
        if (name.match(/^(hd[a-z]|sda|sdb|sdc|sdd)$/)) {
            // IDE/PATA - nombres clásicos hda, hdb o primeros sda/sdb
            ideDevices.push(device);
        } else if (name.match(/^nvme\d+n\d+$/)) {
            // NVMe - nvme0n1, nvme1n1, etc.
            nvmeDevices.push(device);
        } else {
            // SATA/SCSI - resto de dispositivos sd*
            sataDevices.push(device);
        }
    });
    
    // Actualizar controlador IDE
    updateDiskController('ide', ideDevices);
    
    // Actualizar controlador SATA
    updateDiskController('sata', sataDevices);
    
    // Actualizar controlador NVMe
    updateDiskController('nvme', nvmeDevices);
}

/**
 * Actualiza un controlador específico de disco
 */
function updateDiskController(type, devices) {
    // Calcular totales
    let totalReads = 0;
    let totalWrites = 0;
    let totalReadBytes = 0;
    let totalWriteBytes = 0;
    
    devices.forEach(device => {
        totalReads += device.reads || 0;
        totalWrites += device.writes || 0;
        totalReadBytes += device.readBytes || 0;
        totalWriteBytes += device.writeBytes || 0;
    });
    
    // Actualizar estadísticas
    const readsEl = document.getElementById(`${type}Reads`);
    const writesEl = document.getElementById(`${type}Writes`);
    const readBytesEl = document.getElementById(`${type}ReadBytes`);
    const writeBytesEl = document.getElementById(`${type}WriteBytes`);
    
    if (readsEl) readsEl.textContent = formatNumber(totalReads);
    if (writesEl) writesEl.textContent = formatNumber(totalWrites);
    if (readBytesEl) readBytesEl.textContent = formatBytes(totalReadBytes);
    if (writeBytesEl) writeBytesEl.textContent = formatBytes(totalWriteBytes);
    
    // Actualizar estado
    const statusEl = document.getElementById(`${type}Status`);
    const hasActivity = devices.some(d => d.active);
    if (statusEl) {
        statusEl.textContent = devices.length > 0 ? (hasActivity ? 'Activo' : 'Inactivo') : 'No detectado';
        statusEl.style.color = devices.length > 0 ? (hasActivity ? '#00ff88' : '#ffcc00') : '#ff4444';
    }
    
    // Actualizar registros (simular actividad)
    if (hasActivity) {
        updateDiskRegisters(type, devices[0]);
    }
    
    // Actualizar lista de dispositivos
    updateDeviceList(type, devices);
}

/**
 * Actualiza los registros de un controlador de disco
 */
function updateDiskRegisters(type, device) {
    // Los registros se actualizarán solo con datos REALES del sistema
    // No hay simulación de valores
}

/**
 * Actualiza la lista de dispositivos detectados
 */
function updateDeviceList(type, devices) {
    const listEl = document.getElementById(`${type}Devices`);
    if (!listEl) return;
    
    if (devices.length === 0) {
        listEl.innerHTML = '<span class="device-chip" style="opacity: 0.5;">No detectado</span>';
        return;
    }
    
    listEl.innerHTML = devices.map(device => {
        // Calcular capacidad estimada (muy simplificado)
        const totalBytes = device.readBytes + device.writeBytes;
        const capacity = totalBytes > 0 ? formatBytes(totalBytes * 100) : 'Desconocido';
        
        return `<span class="device-chip">${device.name}: ${capacity}</span>`;
    }).join('');
}

// Actualizar eventos de input
function updateInputEvents(inputData) {
    if (inputData.keyboard) {
        document.getElementById('keyboardEvents').textContent = formatNumber(inputData.keyboard.events);
        document.getElementById('lastKey').textContent = inputData.keyboard.lastKey || '-';
    }
    
    if (inputData.mouse) {
        document.getElementById('mouseEvents').textContent = formatNumber(inputData.mouse.events);
        document.getElementById('mousePosition').textContent = 
            inputData.mouse.x !== undefined ? `${inputData.mouse.x}, ${inputData.mouse.y}` : '-';
        document.getElementById('mouseClicks').textContent = formatNumber(inputData.mouse.clicks);
    }
}

// Actualizar puertos de E/S
function updateIOPorts(portsData) {
    const section = document.getElementById('portsSection');
    const tbody = document.getElementById('portsBody');
    
    if (portsData.ports && portsData.ports.length > 0) {
        section.style.display = 'block';
        
        tbody.innerHTML = portsData.ports.slice(0, 15).map(port => `
            <tr>
                <td><code>0x${port.start}</code></td>
                <td><code>0x${port.end}</code></td>
                <td>${escapeHtml(port.device)}</td>
            </tr>
        `).join('');
    }
}

// Visualización de registros con Canvas
let registersCanvas;
let registersCtx;

function initRegistersCanvas() {
    registersCanvas = document.getElementById('registersCanvas');
    registersCtx = registersCanvas.getContext('2d');
    
    // Ajustar tamaño del canvas
    const container = registersCanvas.parentElement;
    registersCanvas.width = container.clientWidth;
    registersCanvas.height = 300;
}

function updateRegistersVisualization(data) {
    if (!registersCtx) {
        initRegistersCanvas();
    }
    
    const width = registersCanvas.width;
    const height = registersCanvas.height;
    
    // Limpiar canvas
    registersCtx.fillStyle = '#1a1a2e';
    registersCtx.fillRect(0, 0, width, height);
    
    // Dibujar grid
    registersCtx.strokeStyle = '#2a2a3e';
    registersCtx.lineWidth = 1;
    
    for (let i = 0; i < height; i += 30) {
        registersCtx.beginPath();
        registersCtx.moveTo(0, i);
        registersCtx.lineTo(width, i);
        registersCtx.stroke();
    }
    
    // Dibujar gráficos de actividad de interrupciones
    if (data.interrupts && data.interrupts.interrupts) {
        const activeInterrupts = data.interrupts.interrupts
            .filter(irq => ['keyboard', 'mouse', 'disk', 'network'].includes(irq.type))
            .slice(0, 4);
        
        activeInterrupts.forEach((irq, index) => {
            const history = interruptHistory[irq.irq] || [];
            if (history.length < 2) return;
            
            const y = 50 + (index * 60);
            const colors = {
                keyboard: '#00d9ff',
                mouse: '#00ff88',
                disk: '#ff6b6b',
                network: '#ffd93d'
            };
            
            const color = colors[irq.type] || '#ffffff';
            
            // Dibujar etiqueta
            registersCtx.fillStyle = color;
            registersCtx.font = '12px monospace';
            registersCtx.fillText(`IRQ ${irq.irq} - ${irq.type}`, 10, y - 5);
            
            // Dibujar línea de actividad
            registersCtx.strokeStyle = color;
            registersCtx.lineWidth = 2;
            registersCtx.beginPath();
            
            const pointSpacing = (width - 100) / maxHistoryLength;
            const maxValue = Math.max(...history, 1);
            
            history.forEach((value, i) => {
                const x = 80 + (i * pointSpacing);
                const valueHeight = (value / maxValue) * 40;
                const pointY = y - valueHeight;
                
                if (i === 0) {
                    registersCtx.moveTo(x, pointY);
                } else {
                    registersCtx.lineTo(x, pointY);
                }
            });
            
            registersCtx.stroke();
        });
    }
}

// Actualizar tiempo de última actualización
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES');
    document.getElementById('lastUpdate').textContent = timeString;
}

// Actualizar nota de plataforma
function updatePlatformNote(note) {
    if (note) {
        document.getElementById('platformNote').textContent = note;
    }
}

// Utilidades
function formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString('es-ES');
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cargar información del sistema
async function loadSystemInfo() {
    try {
        const response = await fetch('/api/system-info');
        const info = await response.json();
        
        document.getElementById('platform').textContent = info.platform;
        document.getElementById('arch').textContent = info.arch;
        document.getElementById('cpus').textContent = info.cpus;
        document.getElementById('hostname').textContent = info.hostname;
    } catch (error) {
        console.error('Error cargando información del sistema:', error);
    }
}

// Ajustar canvas al cambiar tamaño de ventana
window.addEventListener('resize', () => {
    if (registersCanvas) {
        const container = registersCanvas.parentElement;
        registersCanvas.width = container.clientWidth;
        registersCanvas.height = 300;
    }
});

// ========================================
// CAPTURA DE EVENTOS REALES DEL HARDWARE
// ========================================

let keyboardEvents = [];
let mouseEvents = [];
const maxRealtimeEvents = 30; // 30 eventos por controlador

let mousePosition = { x: 0, y: 0 };
let mouseMovementCount = 0;
let mouseClickCount = 0;

/**
 * Maneja un evento en tiempo real del hardware
 */
function handleRealtimeEvent(event) {
    console.log('Evento REAL capturado:', event);
    
    if (event.device === 'keyboard') {
        // Agregar a la lista de teclado
        keyboardEvents.unshift(event);
        if (keyboardEvents.length > maxRealtimeEvents) {
            keyboardEvents.pop();
        }
        
        // Actualizar buffer de texto
        updateTextBuffer(event);
        
        // Actualizar tabla de teclado
        updateKeyboardEventsTable();
        
        // Actualizar registros de teclado
        updateKeyboardRegisters(event);
        
        // Actualizar modo de captura
        updateCaptureMode('keyboard', event);
        
        // Actualizar badge de estado
        document.getElementById('keyboardStatus').textContent = 'Activo';
        document.getElementById('keyboardStatus').style.background = 'rgba(0, 217, 255, 0.3)';
        
    } else if (event.device === 'mouse') {
        // Agregar a la lista de mouse
        mouseEvents.unshift(event);
        if (mouseEvents.length > maxRealtimeEvents) {
            mouseEvents.pop();
        }
        
        // Actualizar estadísticas del mouse
        updateMouseStats(event);
        
        // Actualizar tabla de mouse
        updateMouseEventsTable();
        
        // Actualizar registros de mouse
        updateMouseRegisters(event);
        
        // Actualizar modo de captura
        updateCaptureMode('mouse', event);
        
        // Actualizar badge de estado
        document.getElementById('mouseStatus').textContent = 'Activo';
        document.getElementById('mouseStatus').style.background = 'rgba(0, 255, 136, 0.3)';
    }
}

/**
 * Actualiza la tabla de eventos del teclado
 */
function updateKeyboardEventsTable() {
    const tbody = document.getElementById('keyboardEventsBody');
    
    if (keyboardEvents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">⌨️ Presiona cualquier tecla...</td></tr>';
        return;
    }
    
    tbody.innerHTML = keyboardEvents.map(event => {
        const time = new Date(event.timestamp).toLocaleTimeString('es-ES', { 
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 
        });
        
        const keyName = event.keyName || event.key || '-';
        const scanCode = event.scanCode !== undefined ? `<code>${event.scanCode}</code> (${event.codeHex})` : '-';
        const value = event.value !== undefined ? `${event.value} (${event.valueHex})` : '-';
        const port = event.register ? `<code>${event.register.port}</code>` : '-';
        const register = event.register ? `<code>${event.register.value}</code>` : '-';
        
        const sourceTag = event.source === 'browser' ? '<span class="source-tag">BROWSER</span>' : '<span class="source-tag hardware">HARDWARE</span>';
        
        return `
            <tr class="flash-row">
                <td class="time-cell">${time}</td>
                <td class="action-cell">${event.action || '-'} ${sourceTag}</td>
                <td class="key-display"><strong>${keyName}</strong></td>
                <td>${scanCode}</td>
                <td class="value-cell">${value}</td>
                <td class="port-cell">${port}</td>
                <td class="register-cell">${register}</td>
            </tr>
        `;
    }).join('');
    
    // Remover clase flash después de un momento
    setTimeout(() => {
        const rows = tbody.querySelectorAll('.flash-row');
        rows.forEach(row => row.classList.remove('flash-row'));
    }, 300);
}

/**
 * Actualiza la tabla de eventos del mouse
 */
function updateMouseEventsTable() {
    const tbody = document.getElementById('mouseEventsBody');
    
    if (mouseEvents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">🖱️ Mueve el mouse o haz click...</td></tr>';
        return;
    }
    
    tbody.innerHTML = mouseEvents.map(event => {
        const time = new Date(event.timestamp).toLocaleTimeString('es-ES', { 
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 
        });
        
        // Para clics, mostrar PRESS/RELEASE; para movimiento, mostrar el eje
        let type = event.action || event.axis || 'MOVE';
        let axisOrButton = event.axis || event.keyName || '-';
        
        // Si es un evento de clic (EV_KEY con keyName que incluye CLICK)
        if (event.type === 'EV_KEY' && event.keyName && event.keyName.includes('CLICK')) {
            type = event.action; // PRESS o RELEASE
            axisOrButton = event.keyName; // LEFT_CLICK, RIGHT_CLICK, etc.
        }
        
        const displayValue = event.movement !== undefined ? event.movement : (event.value || 0);
        const value = event.value !== undefined ? `${event.value} (${event.valueHex})` : '-';
        const port = event.register ? `<code>${event.register.port}</code>` : '-';
        const register = event.register ? `<code>${event.register.value}</code>` : '-';
        
        const sourceTag = event.source === 'browser' ? '<span class="source-tag">BROWSER</span>' : '<span class="source-tag hardware">HARDWARE</span>';
        
        return `
            <tr class="flash-row">
                <td class="time-cell">${time}</td>
                <td class="action-cell">${type} ${sourceTag}</td>
                <td class="key-display"><strong>${axisOrButton}</strong></td>
                <td>${displayValue}</td>
                <td class="value-cell">${value}</td>
                <td class="port-cell">${port}</td>
                <td class="register-cell">${register}</td>
            </tr>
        `;
    }).join('');
    
    // Remover clase flash después de un momento
    setTimeout(() => {
        const rows = tbody.querySelectorAll('.flash-row');
        rows.forEach(row => row.classList.remove('flash-row'));
    }, 300);
}

/**
 * Actualiza el modo de captura
 */
function updateCaptureMode(device, event) {
    const modeElId = device === 'keyboard' ? 'keyboardCaptureMode' : 'mouseCaptureMode';
    const modeEl = document.getElementById(modeElId);
    
    if (!modeEl) return;
    
    if (event.source === 'browser') {
        modeEl.innerHTML = '📝 Modo: Captura desde NAVEGADOR (ejecuta con sudo en Linux para acceso real al hardware)';
        modeEl.className = 'capture-mode browser-mode';
    } else {
        modeEl.innerHTML = '✅ Modo: Captura DIRECTA del HARDWARE (/dev/input)';
        modeEl.className = 'capture-mode hardware-mode';
    }
}

/**
 * Actualiza las estadísticas del mouse
 */
function updateMouseStats(event) {
    // Actualizar contador de movimientos
    if (event.type === 'EV_REL' && (event.axis === 'X' || event.axis === 'Y')) {
        mouseMovementCount++;
        document.getElementById('mouseMovements').textContent = mouseMovementCount;
        
        // Simular posición (si no tenemos posición real del navegador)
        if (event.axis === 'X') {
            mousePosition.x += event.movement || 0;
        } else if (event.axis === 'Y') {
            mousePosition.y += event.movement || 0;
        }
        
        document.getElementById('mouseX').textContent = mousePosition.x;
        document.getElementById('mouseY').textContent = mousePosition.y;
    }
    
    // Actualizar contador de clicks
    if (event.action === 'PRESS' && event.keyName && event.keyName.includes('CLICK')) {
        mouseClickCount++;
        document.getElementById('mouseClicksCount').textContent = mouseClickCount;
        console.log(`🖱️ Click detectado: ${event.keyName}, Total: ${mouseClickCount}`);
    }
}

/**
 * Efecto visual cuando se captura un evento (legacy - mantener para compatibilidad)
 */
function flashRegisters(event) {
    // Mantener para compatibilidad, pero delegar a funciones específicas
    if (event.device === 'keyboard') {
        updateKeyboardRegisters(event);
    } else if (event.device === 'mouse') {
        updateMouseRegisters(event);
    }
}

// ========================================
// BUFFER DE TEXTO Y VISUALIZACIÓN FIEL
// ========================================

let textBuffer = '';

/**
 * Actualiza el buffer de texto con la tecla presionada
 */
function updateTextBuffer(event) {
    if (event.device !== 'keyboard' || event.action !== 'PRESS') return;
    
    const key = event.keyName || event.key;
    
    // Manejar teclas especiales
    if (key === 'BACKSPACE' || key === 'Backspace') {
        textBuffer = textBuffer.slice(0, -1);
    } else if (key === 'ENTER' || key === 'Enter') {
        textBuffer += '\n';
    } else if (key === 'SPACE' || key === 'Space') {
        textBuffer += ' ';
    } else if (key === 'TAB' || key === 'Tab') {
        textBuffer += '    ';
    } else if (key.length === 1) {
        // Solo agregar caracteres imprimibles
        textBuffer += key;
    } else if (key.match(/^[A-Z]$/)) {
        textBuffer += key;
    }
    
    // Actualizar display
    const bufferEl = document.getElementById('textBuffer');
    if (textBuffer.length === 0) {
        bufferEl.innerHTML = '<span class="placeholder">Empieza a escribir aquí...</span>';
    } else {
        bufferEl.textContent = textBuffer;
    }
    
    // Actualizar contador
    document.getElementById('charCount').textContent = textBuffer.length;
    document.getElementById('lastKeyPress').textContent = key;
    
    // Auto-scroll al final
    bufferEl.scrollTop = bufferEl.scrollHeight;
}

// ========================================
// VISUALIZACIÓN DE REGISTROS POR CONTROLADOR
// ========================================

/**
 * Actualiza los registros del controlador de teclado
 */
function updateKeyboardRegisters(event) {
    // Data Register (Puerto 0x60) - Solo con datos REALES
    updateRegisterBox('keyboardDataRegister', event.register.value, event.scanCode);
    
    // Los demás registros solo se actualizarán con datos REALES del hardware
    // No hay simulación de Status, Command o Control Registers
}

/**
 * Actualiza los registros del controlador de mouse
 */
function updateMouseRegisters(event) {
    // Data Register (Puerto 0x60) - Solo con datos REALES
    updateRegisterBox('mouseDataRegister', event.register.value, event.value);
    
    // Los demás registros solo se actualizarán con datos REALES del hardware
    // No hay simulación de Status, Command o Control Registers
}

/**
 * Actualiza la visualización de todos los registros (legacy)
 */
function updateRegistersDisplay(event) {
    if (event.device === 'keyboard') {
        updateKeyboardRegisters(event);
    } else if (event.device === 'mouse') {
        updateMouseRegisters(event);
    }
}

/**
 * Actualiza un registro individual
 */
function updateRegisterBox(registerId, hexValue, scanCode) {
    const registerEl = document.getElementById(registerId);
    if (!registerEl) return;
    
    // Convertir a número
    let value;
    if (typeof hexValue === 'string' && hexValue.startsWith('0x')) {
        value = parseInt(hexValue.substring(2), 16);
    } else if (typeof hexValue === 'number') {
        value = hexValue;
    } else {
        value = scanCode || 0;
    }
    
    // Actualizar valor hexadecimal
    const valueEl = registerEl.querySelector('.register-value');
    if (valueEl) {
        valueEl.textContent = `0x${value.toString(16).padStart(2, '0').toUpperCase()}`;
        valueEl.classList.add('register-flash-value');
        setTimeout(() => valueEl.classList.remove('register-flash-value'), 300);
    }
    
    // Actualizar valor binario
    const binaryEl = registerEl.querySelector('.register-binary');
    if (binaryEl) {
        binaryEl.textContent = value.toString(2).padStart(8, '0');
        binaryEl.classList.add('register-flash-value');
        setTimeout(() => binaryEl.classList.remove('register-flash-value'), 300);
    }
    
    // Agregar indicador de actividad
    const activityEl = registerEl.querySelector('.register-activity');
    if (activityEl) {
        activityEl.innerHTML = '<span class="activity-pulse">●</span>';
        setTimeout(() => activityEl.innerHTML = '', 500);
    }
}

/**
 * Captura eventos del navegador como fallback
 */
function setupBrowserEventCapture() {
    // Capturar teclas
    document.addEventListener('keydown', (e) => {
        // Prevenir que ciertas teclas afecten la página
        if (['Tab', 'F5', 'F11'].includes(e.key)) {
            // No prevenir por defecto para permitir navegación
        }
        
        sendBrowserEvent({
            device: 'keyboard',
            type: 'keyboard',
            key: e.key.length === 1 ? e.key : e.key,
            code: e.keyCode,
            scanCode: e.keyCode,
            value: 1,
            action: 'PRESS'
        });
    });
    
    document.addEventListener('keyup', (e) => {
        sendBrowserEvent({
            device: 'keyboard',
            type: 'keyboard',
            key: e.key.length === 1 ? e.key : e.key,
            code: e.keyCode,
            scanCode: e.keyCode,
            value: 0,
            action: 'RELEASE'
        });
    });
    
    // Capturar movimiento del mouse
    let lastMouseSend = 0;
    document.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - lastMouseSend < 100) return; // Throttle
        lastMouseSend = now;
        
        // Actualizar posición global
        mousePosition.x = e.clientX;
        mousePosition.y = e.clientY;
        
        sendBrowserEvent({
            device: 'mouse',
            type: 'mouse',
            axis: e.movementX !== 0 ? 'X' : (e.movementY !== 0 ? 'Y' : 'MOVE'),
            code: e.movementX !== 0 ? 0 : 1,
            value: e.movementX !== 0 ? e.movementX : e.movementY,
            movement: e.movementX !== 0 ? e.movementX : e.movementY,
            action: `X:${e.clientX} Y:${e.clientY}`
        });
    });
    
    // Capturar clicks
    document.addEventListener('mousedown', (e) => {
        sendBrowserEvent({
            device: 'mouse',
            type: 'mouse',
            key: `BUTTON_${e.button}`,
            axis: 'CLICK',
            code: 272 + e.button,
            value: 1,
            action: 'PRESS'
        });
    });
    
    document.addEventListener('mouseup', (e) => {
        sendBrowserEvent({
            device: 'mouse',
            type: 'mouse',
            key: `BUTTON_${e.button}`,
            axis: 'CLICK',
            code: 272 + e.button,
            value: 0,
            action: 'RELEASE'
        });
    });
    
    // Botón para limpiar buffer
    document.getElementById('clearBuffer').addEventListener('click', () => {
        textBuffer = '';
        document.getElementById('textBuffer').innerHTML = '<span class="placeholder">Empieza a escribir aquí...</span>';
        document.getElementById('charCount').textContent = '0';
    });
}

/**
 * Envía evento del navegador al servidor
 */
function sendBrowserEvent(eventData) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'browser-event',
            event: eventData
        }));
    }
}



// ========================================
// SISTEMA DE PESTAÑAS (TABS)
// ========================================

/**
 * Inicializa el sistema de pestañas
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

/**
 * Cambia a una pestaña específica
 */
function switchTab(tabId) {
    // Remover clase active de todos los botones y paneles
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    // Agregar clase active al botón y panel seleccionado
    const activeButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    const activePane = document.getElementById(`tab-${tabId}`);
    
    if (activeButton) activeButton.classList.add('active');
    if (activePane) activePane.classList.add('active');
    
    // Redimensionar canvas si estamos en la pestaña de interrupciones
    if (tabId === 'interrupts' && registersCanvas) {
        setTimeout(() => {
            const container = registersCanvas.parentElement;
            registersCanvas.width = container.clientWidth;
            registersCanvas.height = 300;
        }, 100);
    }
}

// ============================================
// SISTEMA DE PESTAÑAS (TABS)
// ============================================

// Simulador del Controlador de Teclado
function initKeyboardSimulator() {
    const commandSelect = document.getElementById('keyboardCommand');
    const sendButton = document.getElementById('sendKeyboardCommand');
    const output = document.getElementById('keyboardSimulatorOutput');
    
    if (!commandSelect || !sendButton || !output) return;
    
    sendButton.addEventListener('click', () => {
        const command = commandSelect.value;
        const option = commandSelect.options[commandSelect.selectedIndex];
        const description = option.textContent;
        
        simulateKeyboardCommand(command, description, output);
    });
}

function simulateKeyboardCommand(command, description, outputEl) {
    const timestamp = new Date().toLocaleTimeString();
    const commandValue = parseInt(command, 16);
    
    // Definir respuestas simuladas para cada comando
    const responses = {
        0x20: { 
            ack: '0xFA',
            data: '0x65',
            desc: 'Byte de control leído exitosamente',
            registers: [
                { name: 'Command Register', value: '0x20' },
                { name: 'Data Register', value: '0x65' }
            ]
        },
        0x60: { 
            ack: '0xFA',
            data: null,
            desc: 'Listo para recibir el nuevo byte de control',
            registers: [
                { name: 'Command Register', value: '0x60' },
                { name: 'Status Register', value: '0x02 (IBF=1)' }
            ]
        },
        0xAA: { 
            ack: '0xFA',
            data: '0x55',
            desc: 'Self-test completado exitosamente',
            registers: [
                { name: 'Command Register', value: '0xAA' },
                { name: 'Data Register', value: '0x55 (Test OK)' }
            ]
        },
        0xAB: { 
            ack: '0xFA',
            data: '0x00',
            desc: 'Interface del teclado funcionando correctamente',
            registers: [
                { name: 'Command Register', value: '0xAB' },
                { name: 'Data Register', value: '0x00 (No errors)' }
            ]
        },
        0xAD: { 
            ack: '0xFA',
            data: null,
            desc: 'Teclado deshabilitado',
            registers: [
                { name: 'Command Register', value: '0xAD' },
                { name: 'Control Register', value: '0x00 (IRQ1 disabled)' }
            ]
        },
        0xAE: { 
            ack: '0xFA',
            data: null,
            desc: 'Teclado habilitado',
            registers: [
                { name: 'Command Register', value: '0xAE' },
                { name: 'Control Register', value: '0x01 (IRQ1 enabled)' }
            ]
        },
        0xED: { 
            ack: '0xFA',
            data: null,
            desc: 'Listo para recibir byte de LEDs',
            registers: [
                { name: 'Command Register', value: '0xED' },
                { name: 'Status Register', value: '0x02 (Waiting for data)' }
            ]
        },
        0xF0: { 
            ack: '0xFA',
            data: '0xAB83',
            desc: 'ID del teclado: MF2 con traducción',
            registers: [
                { name: 'Command Register', value: '0xF0' },
                { name: 'Data Register', value: '0xAB' }
            ]
        },
        0xFF: { 
            ack: '0xFA',
            data: '0xAA',
            desc: 'Reset completado exitosamente',
            registers: [
                { name: 'Command Register', value: '0xFF' },
                { name: 'Data Register', value: '0xAA (BAT Passed)' }
            ]
        }
    };
    
    const response = responses[commandValue] || {
        ack: '0xFE',
        data: null,
        desc: 'Comando no reconocido - Resend',
        registers: []
    };
    
    // Crear la entrada en el output
    const entryDiv = document.createElement('div');
    entryDiv.className = 'command-entry';
    entryDiv.innerHTML = `
        <div class="timestamp">⏱️ ${timestamp}</div>
        <div class="command-sent">📤 Comando: ${command}</div>
        <div class="command-description">${description}</div>
        <div class="response">
            <div class="response-label">📥 Respuesta del Controlador:</div>
            <div class="response-data">ACK: ${response.ack}</div>
            ${response.data ? `<div class="response-data">Data: ${response.data}</div>` : ''}
            <div class="response-data">${response.desc}</div>
            ${response.registers.length > 0 ? `
                <div class="register-updates">
                    <strong>Actualización de Registros:</strong>
                    ${response.registers.map(reg => 
                        `<div class="register-update">
                            <span class="register-name">${reg.name}:</span> 
                            <span class="register-value">${reg.value}</span>
                        </div>`
                    ).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    // Remover el placeholder si existe
    const placeholder = outputEl.querySelector('.output-placeholder');
    if (placeholder) placeholder.remove();
    
    // Agregar la nueva entrada al principio
    outputEl.insertBefore(entryDiv, outputEl.firstChild);
    
    // Limitar a 10 entradas
    const entries = outputEl.querySelectorAll('.command-entry');
    if (entries.length > 10) {
        entries[entries.length - 1].remove();
    }
}

// Simulador del Controlador de Mouse
function initMouseSimulator() {
    const commandSelect = document.getElementById('mouseCommand');
    const sendButton = document.getElementById('sendMouseCommand');
    const output = document.getElementById('mouseSimulatorOutput');
    
    if (!commandSelect || !sendButton || !output) return;
    
    sendButton.addEventListener('click', () => {
        const command = commandSelect.value;
        const option = commandSelect.options[commandSelect.selectedIndex];
        const description = option.textContent;
        
        simulateMouseCommand(command, description, output);
    });
}

function simulateMouseCommand(command, description, outputEl) {
    const timestamp = new Date().toLocaleTimeString();
    const commandValue = parseInt(command, 16);
    
    // Definir respuestas simuladas para cada comando
    const responses = {
        0xE6: { 
            ack: '0xFA',
            data: null,
            desc: 'Scaling 1:1 configurado',
            registers: [
                { name: 'Command Register', value: '0xE6' },
                { name: 'Mouse Config', value: 'Scaling 1:1' }
            ]
        },
        0xE7: { 
            ack: '0xFA',
            data: null,
            desc: 'Scaling 2:1 configurado',
            registers: [
                { name: 'Command Register', value: '0xE7' },
                { name: 'Mouse Config', value: 'Scaling 2:1' }
            ]
        },
        0xE8: { 
            ack: '0xFA',
            data: null,
            desc: 'Listo para recibir valor de resolución',
            registers: [
                { name: 'Command Register', value: '0xE8' },
                { name: 'Status Register', value: '0x02 (Waiting)' }
            ]
        },
        0xE9: { 
            ack: '0xFA',
            data: '0x00 0x03 0x64',
            desc: 'Estado: Botones=0, Resolución=3, Sample Rate=100',
            registers: [
                { name: 'Command Register', value: '0xE9' },
                { name: 'Data Bytes', value: '3 bytes enviados' }
            ]
        },
        0xF0: { 
            ack: '0xFA',
            data: null,
            desc: 'Modo remoto activado',
            registers: [
                { name: 'Command Register', value: '0xF0' },
                { name: 'Mouse Mode', value: 'Remote Mode' }
            ]
        },
        0xF2: { 
            ack: '0xFA',
            data: '0x00',
            desc: 'ID del dispositivo: Mouse estándar PS/2',
            registers: [
                { name: 'Command Register', value: '0xF2' },
                { name: 'Device ID', value: '0x00 (Standard PS/2)' }
            ]
        },
        0xF3: { 
            ack: '0xFA',
            data: null,
            desc: 'Listo para recibir sample rate',
            registers: [
                { name: 'Command Register', value: '0xF3' },
                { name: 'Status Register', value: '0x02 (Waiting)' }
            ]
        },
        0xF4: { 
            ack: '0xFA',
            data: null,
            desc: 'Data reporting habilitado',
            registers: [
                { name: 'Command Register', value: '0xF4' },
                { name: 'Mouse Status', value: 'Enabled' }
            ]
        },
        0xF5: { 
            ack: '0xFA',
            data: null,
            desc: 'Data reporting deshabilitado',
            registers: [
                { name: 'Command Register', value: '0xF5' },
                { name: 'Mouse Status', value: 'Disabled' }
            ]
        },
        0xFF: { 
            ack: '0xFA',
            data: '0xAA 0x00',
            desc: 'Reset completado: BAT OK, Device ID=0x00',
            registers: [
                { name: 'Command Register', value: '0xFF' },
                { name: 'Data Register', value: '0xAA (BAT OK)' }
            ]
        }
    };
    
    const response = responses[commandValue] || {
        ack: '0xFE',
        data: null,
        desc: 'Comando no reconocido - Resend',
        registers: []
    };
    
    // Crear la entrada en el output
    const entryDiv = document.createElement('div');
    entryDiv.className = 'command-entry';
    entryDiv.innerHTML = `
        <div class="timestamp">⏱️ ${timestamp}</div>
        <div class="command-sent">📤 Comando: ${command}</div>
        <div class="command-description">${description}</div>
        <div class="response">
            <div class="response-label">📥 Respuesta del Mouse:</div>
            <div class="response-data">ACK: ${response.ack}</div>
            ${response.data ? `<div class="response-data">Data: ${response.data}</div>` : ''}
            <div class="response-data">${response.desc}</div>
            ${response.registers.length > 0 ? `
                <div class="register-updates">
                    <strong>Actualización de Registros:</strong>
                    ${response.registers.map(reg => 
                        `<div class="register-update">
                            <span class="register-name">${reg.name}:</span> 
                            <span class="register-value">${reg.value}</span>
                        </div>`
                    ).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    // Remover el placeholder si existe
    const placeholder = outputEl.querySelector('.output-placeholder');
    if (placeholder) placeholder.remove();
    
    // Agregar la nueva entrada al principio
    outputEl.insertBefore(entryDiv, outputEl.firstChild);
    
    // Limitar a 10 entradas
    const entries = outputEl.querySelectorAll('.command-entry');
    if (entries.length > 10) {
        entries[entries.length - 1].remove();
    }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    loadSystemInfo();
    connectWebSocket();
    initRegistersCanvas();
    setupBrowserEventCapture();
    initTabs();
});

// Limpiar al cerrar
window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
});
