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
    // Simular valores de registros basados en actividad
    if (type === 'ide') {
        // Actualizar registros IDE
        if (device.readsDelta > 0 || device.writesDelta > 0) {
            const dataReg = document.getElementById('ideDataRegister');
            const statusReg = document.getElementById('ideStatusRegister');
            
            if (dataReg) {
                const dataValue = Math.floor(Math.random() * 256);
                updateRegisterBox('ideDataRegister', `0x${dataValue.toString(16).padStart(2, '0').toUpperCase()}`, null);
            }
            
            if (statusReg) {
                // Bit 7: BSY (busy), Bit 6: DRDY (drive ready), Bit 3: DRQ (data request)
                const status = device.writesDelta > 0 ? 0x58 : 0x50; // Con o sin DRQ
                updateRegisterBox('ideStatusRegister', `0x${status.toString(16).padStart(2, '0').toUpperCase()}`, null);
                
                // Actualizar flags
                const busyFlag = document.getElementById('ide-flag-busy');
                const drdyFlag = document.getElementById('ide-flag-drdy');
                const errFlag = document.getElementById('ide-flag-err');
                
                if (busyFlag) {
                    if (device.active) {
                        busyFlag.classList.add('flag-active');
                        setTimeout(() => busyFlag.classList.remove('flag-active'), 500);
                    }
                }
                
                if (drdyFlag) drdyFlag.classList.add('flag-active');
                if (errFlag) errFlag.classList.remove('flag-active');
            }
            
            // Command register - simular último comando
            const command = device.writesDelta > 0 ? 0x30 : 0x20; // WRITE/READ SECTORS
            updateRegisterBox('ideCommandRegister', `0x${command.toString(16).padStart(2, '0').toUpperCase()}`, null);
            
            // LBA register - dirección aleatoria
            const lba = Math.floor(Math.random() * 0xFFFFFF);
            updateRegisterBox('ideLBARegister', `0x${lba.toString(16).padStart(8, '0').toUpperCase()}`, null);
        }
    } else if (type === 'sata') {
        // Actualizar registros SATA/AHCI
        if (device.readsDelta > 0 || device.writesDelta > 0) {
            // Port Status - enlace activo
            updateRegisterBox('sataPortStatusRegister', '0x123', null);
            
            // Command Register
            const cmdValue = 0x0017; // ST + FRE + POD + SUD
            updateRegisterBox('sataCommandRegister', `0x${cmdValue.toString(16).padStart(4, '0').toUpperCase()}`, null);
            
            // Task File Data
            const tfdValue = device.active ? 0x50 : 0x00;
            updateRegisterBox('sataTFDataRegister', `0x${tfdValue.toString(16).padStart(2, '0').toUpperCase()}`, null);
            
            // Actualizar flags
            const detFlag = document.getElementById('sata-flag-det');
            const spdFlag = document.getElementById('sata-flag-spd');
            const stFlag = document.getElementById('sata-flag-st');
            const freFlag = document.getElementById('sata-flag-fre');
            
            if (detFlag) detFlag.classList.add('flag-active');
            if (spdFlag) spdFlag.classList.add('flag-active');
            if (stFlag && device.active) {
                stFlag.classList.add('flag-active');
                setTimeout(() => stFlag.classList.remove('flag-active'), 500);
            }
            if (freFlag && device.active) {
                freFlag.classList.add('flag-active');
            }
        }
    } else if (type === 'nvme') {
        // Actualizar registros NVMe
        if (device.readsDelta > 0 || device.writesDelta > 0) {
            // Controller Status
            updateRegisterBox('nvmeStatusRegister', '0x01', null); // RDY bit set
            
            // Controller Config
            updateRegisterBox('nvmeConfigRegister', '0x460001', null);
            
            // Doorbell - incrementar cuando hay actividad
            const doorbellValue = Math.floor(Math.random() * 256);
            updateRegisterBox('nvmeDoorbellRegister', `0x${doorbellValue.toString(16).padStart(4, '0').toUpperCase()}`, null);
            
            // Actualizar flags
            const rdyFlag = document.getElementById('nvme-flag-rdy');
            const cfsFlag = document.getElementById('nvme-flag-cfs');
            const enFlag = document.getElementById('nvme-flag-en');
            
            if (rdyFlag) rdyFlag.classList.add('flag-active');
            if (cfsFlag) cfsFlag.classList.remove('flag-active');
            if (enFlag) enFlag.classList.add('flag-active');
        }
    }
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
    // Data Register (Puerto 0x60)
    updateRegisterBox('keyboardDataRegister', event.register.value, event.scanCode);
    
    // Status Register (Puerto 0x64)
    const statusValue = simulateStatusRegister(event);
    updateRegisterBox('keyboardStatusRegister', statusValue, null);
    updateStatusFlags('keyboard', statusValue);
    
    // Command Register
    updateRegisterBox('keyboardCommandRegister', '0x20', null); // Read command byte
    
    // Control Register
    const controlValue = simulateControlRegister(event);
    updateRegisterBox('keyboardControlRegister', controlValue, null);
    updateControlFlags('keyboard', event.device);
}

/**
 * Actualiza los registros del controlador de mouse
 */
function updateMouseRegisters(event) {
    // Data Register (Puerto 0x60)
    updateRegisterBox('mouseDataRegister', event.register.value, event.value);
    
    // Status Register (Puerto 0x64)
    const statusValue = simulateStatusRegister(event);
    updateRegisterBox('mouseStatusRegister', statusValue, null);
    updateStatusFlags('mouse', statusValue);
    
    // Command Register
    updateRegisterBox('mouseCommandRegister', '0xD4', null); // Write to mouse
    
    // Control Register
    const controlValue = simulateControlRegister(event);
    updateRegisterBox('mouseControlRegister', controlValue, null);
    updateControlFlags('mouse', event.device);
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
 * Simula el valor del Status Register
 */
function simulateStatusRegister(event) {
    let status = 0x00;
    
    // Bit 0: OBF (Output Buffer Full) - Hay datos disponibles para leer
    if (event.action === 'PRESS') {
        status |= 0x01;
    }
    
    // Bit 1: IBF (Input Buffer Full) - El buffer de entrada está lleno
    status |= 0x00; // Normalmente vacío después de procesar
    
    // Bit 5: Mouse Data
    if (event.device === 'mouse') {
        status |= 0x20;
    }
    
    return `0x${status.toString(16).padStart(2, '0').toUpperCase()}`;
}

/**
 * Actualiza los flags del Status Register
 */
function updateStatusFlags(controller, statusValue) {
    const status = parseInt(statusValue.substring(2), 16);
    
    const obfFlagId = controller === 'keyboard' ? 'keyboard-flag-obf' : 'mouse-flag-obf';
    const ibfFlagId = controller === 'keyboard' ? 'keyboard-flag-ibf' : 'mouse-flag-auxdata';
    
    const obfFlag = document.getElementById(obfFlagId);
    if (obfFlag) {
        if (status & 0x01) {
            obfFlag.classList.add('flag-active');
            setTimeout(() => obfFlag.classList.remove('flag-active'), 500);
        } else {
            obfFlag.classList.remove('flag-active');
        }
    }
    
    const ibfFlag = document.getElementById(ibfFlagId);
    if (ibfFlag) {
        if (status & 0x02) {
            ibfFlag.classList.add('flag-active');
            setTimeout(() => ibfFlag.classList.remove('flag-active'), 500);
        } else {
            ibfFlag.classList.remove('flag-active');
        }
    }
}

/**
 * Simula el valor del Control Register
 */
function simulateControlRegister(event) {
    let control = 0x45; // Configuración típica
    
    // Bit 0: IRQ1 habilitado (teclado)
    control |= 0x01;
    
    // Bit 1: IRQ12 habilitado (mouse)
    if (event.device === 'mouse') {
        control |= 0x02;
    }
    
    return `0x${control.toString(16).padStart(2, '0').toUpperCase()}`;
}

/**
 * Actualiza los flags del Control Register
 */
function updateControlFlags(controller, device) {
    if (controller === 'keyboard') {
        const irq1Flag = document.getElementById('keyboard-flag-irq1');
        if (irq1Flag && device === 'keyboard') {
            irq1Flag.classList.add('flag-active');
            setTimeout(() => irq1Flag.classList.remove('flag-active'), 500);
        }
    } else if (controller === 'mouse') {
        const irq12Flag = document.getElementById('mouse-flag-irq12');
        if (irq12Flag && device === 'mouse') {
            irq12Flag.classList.add('flag-active');
            setTimeout(() => irq12Flag.classList.remove('flag-active'), 500);
        }
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

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    loadSystemInfo();
    connectWebSocket();
    initRegistersCanvas();
    setupBrowserEventCapture();
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
