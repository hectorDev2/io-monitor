const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

/**
 * Captura eventos REALES del hardware (teclado, mouse) directamente
 * del sistema operativo, mostrando los valores de registros y códigos de scan
 */
class RealTimeInputCapture {
  constructor() {
    this.platform = os.platform();
    this.events = [];
    this.maxEvents = 100;
    this.isCapturing = false;
    this.captureProcess = null;
  }

  /**
   * Inicia la captura de eventos reales del hardware
   */
  startCapture(callback) {
    if (this.isCapturing) return;
    this.isCapturing = true;

    if (this.platform === 'linux') {
      this.startLinuxCapture(callback);
    } else if (this.platform === 'darwin') {
      this.startMacCapture(callback);
    } else if (this.platform === 'win32') {
      this.startWindowsCapture(callback);
    }
  }

  /**
   * Captura eventos en Linux usando evtest o leyendo directamente /dev/input
   */
  startLinuxCapture(callback) {
    // Primero intentar encontrar dispositivos de input
    fs.readdir('/dev/input', (err, files) => {
      if (err) {
        console.error('No se puede acceder a /dev/input. Ejecuta con sudo.');
        this.startFallbackCapture(callback);
        return;
      }

      // Buscar dispositivos de eventos
      const eventDevices = files.filter(f => f.startsWith('event'));
      
      if (eventDevices.length === 0) {
        this.startFallbackCapture(callback);
        return;
      }

      // Intentar usar el primer dispositivo de eventos
      const devicePath = `/dev/input/${eventDevices[0]}`;
      
      // Verificar si tenemos permisos de lectura
      fs.access(devicePath, fs.constants.R_OK, (err) => {
        if (err) {
          console.error(`No hay permisos para leer ${devicePath}. Ejecuta con sudo para captura real.`);
          this.startFallbackCapture(callback);
          return;
        }

        // Leer eventos directamente del dispositivo
        this.readRawInputDevice(devicePath, callback);
      });
    });
  }

  /**
   * Lee eventos directamente del dispositivo de input
   */
  readRawInputDevice(devicePath, callback) {
    console.log(`📡 Capturando eventos REALES desde: ${devicePath}`);
    
    const stream = fs.createReadStream(devicePath);
    
    stream.on('data', (buffer) => {
      // Estructura del evento input_event en Linux (24 bytes en 64-bit)
      // struct input_event {
      //   struct timeval time; (16 bytes: 8 bytes sec + 8 bytes usec)
      //   __u16 type;          (2 bytes)
      //   __u16 code;          (2 bytes)
      //   __s32 value;         (4 bytes)
      // }
      
      // Validar que tenemos múltiplos de 24 bytes
      if (buffer.length % 24 !== 0) {
        console.warn(`Tamaño de buffer inválido: ${buffer.length} bytes (no es múltiplo de 24)`);
      }
      
      for (let i = 0; i + 24 <= buffer.length; i += 24) {
        const type = buffer.readUInt16LE(i + 16);
        const code = buffer.readUInt16LE(i + 18);
        const value = buffer.readInt32LE(i + 20);
        
        // Timestamp - timeval is 16 bytes on 64-bit systems (tv_sec: 8 bytes, tv_usec: 8 bytes)
        // Read only lower 32 bits for compatibility (timestamps fit in 32-bit until year 2106)
        const sec = buffer.readUInt32LE(i);        // Lower 32 bits of tv_sec
        const usec = buffer.readUInt32LE(i + 8);   // Lower 32 bits of tv_usec
        
        // Validar que usec es razonable (debe ser < 1,000,000)
        if (usec >= 1000000) {
          console.warn(`usec inválido: ${usec} (debe ser < 1,000,000). Posible error de parsing.`);
          continue;
        }
        
        const event = this.parseLinuxEvent(type, code, value, sec, usec);
        
        if (event) {
          this.addEvent(event);
          callback(event);
        }
      }
    });

    stream.on('error', (err) => {
      console.error('Error leyendo dispositivo:', err.message);
      this.startFallbackCapture(callback);
    });

    this.captureProcess = stream;
  }

  /**
   * Parsea un evento de Linux y extrae información detallada
   */
  parseLinuxEvent(type, code, value, sec, usec) {
    const EVENT_TYPES = {
      0x00: 'EV_SYN',
      0x01: 'EV_KEY',
      0x02: 'EV_REL',
      0x03: 'EV_ABS',
      0x04: 'EV_MSC'
    };

    const typeName = EVENT_TYPES[type] || `UNKNOWN(${type})`;
    
    // Solo procesar eventos de teclas y movimiento
    if (type === 0x01) { // EV_KEY
      return {
        timestamp: Date.now(),
        device: 'keyboard',
        type: 'EV_KEY',
        typeHex: `0x${type.toString(16).padStart(2, '0')}`,
        code: code,
        codeHex: `0x${code.toString(16).padStart(4, '0')}`,
        value: value,
        valueHex: `0x${value.toString(16).padStart(8, '0')}`,
        action: value === 1 ? 'PRESS' : value === 0 ? 'RELEASE' : 'REPEAT',
        keyName: this.getKeyName(code),
        scanCode: code,
        register: {
          port: '0x60', // Puerto del controlador de teclado
          dataRegister: '0x60',
          statusRegister: '0x64',
          value: `0x${code.toString(16).padStart(2, '0')}`
        }
      };
    } else if (type === 0x02) { // EV_REL (mouse movement)
      return {
        timestamp: Date.now(),
        device: 'mouse',
        type: 'EV_REL',
        typeHex: `0x${type.toString(16).padStart(2, '0')}`,
        code: code,
        codeHex: `0x${code.toString(16).padStart(4, '0')}`,
        value: value,
        valueHex: `0x${value.toString(16).padStart(8, '0')}`,
        axis: code === 0 ? 'X' : code === 1 ? 'Y' : code === 8 ? 'WHEEL' : 'OTHER',
        movement: value,
        register: {
          port: '0x60', // Puerto PS/2
          dataRegister: '0x60',
          statusRegister: '0x64',
          value: `0x${Math.abs(value).toString(16).padStart(2, '0')}`
        }
      };
    }

    return null;
  }

  /**
   * Obtiene el nombre de la tecla según el código
   */
  getKeyName(code) {
    const KEY_CODES = {
      1: 'ESC', 2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
      16: 'Q', 17: 'W', 18: 'E', 19: 'R', 20: 'T', 21: 'Y', 22: 'U', 23: 'I', 24: 'O', 25: 'P',
      30: 'A', 31: 'S', 32: 'D', 33: 'F', 34: 'G', 35: 'H', 36: 'J', 37: 'K', 38: 'L',
      44: 'Z', 45: 'X', 46: 'C', 47: 'V', 48: 'B', 49: 'N', 50: 'M',
      28: 'ENTER', 29: 'CTRL', 42: 'LSHIFT', 54: 'RSHIFT', 56: 'ALT', 57: 'SPACE',
      103: 'UP', 105: 'LEFT', 106: 'RIGHT', 108: 'DOWN',
      272: 'LEFT_CLICK', 273: 'RIGHT_CLICK', 274: 'MIDDLE_CLICK'
    };

    return KEY_CODES[code] || `KEY_${code}`;
  }

  /**
   * Captura en macOS usando IOKit
   */
  startMacCapture(callback) {
    console.log('⚠️  macOS: Capturando eventos del navegador (acceso limitado al hardware)');
    
    // En macOS necesitamos usar CGEventTap que requiere permisos especiales
    // Como alternativa, capturamos eventos del navegador
    this.startFallbackCapture(callback);
  }

  /**
   * Captura en Windows
   */
  startWindowsCapture(callback) {
    console.log('⚠️  Windows: Capturando eventos del navegador (acceso limitado al hardware)');
    this.startFallbackCapture(callback);
  }

  /**
   * Modo fallback: captura eventos desde el navegador
   */
  startFallbackCapture(callback) {
    console.log('📝 Modo fallback: Los eventos se capturarán desde el navegador');
    // Los eventos serán enviados por el cliente
  }

  /**
   * Agrega un evento simulado (desde el navegador)
   */
  addBrowserEvent(eventData) {
    // Convertir nombres de botones a formato estándar (ej: BUTTON_0 -> LEFT_CLICK)
    let keyName = eventData.key;
    let isMouseClick = false;
    
    if (eventData.axis === 'CLICK' && eventData.key) {
      const buttonMap = {
        'BUTTON_0': 'LEFT_CLICK',
        'BUTTON_1': 'MIDDLE_CLICK',
        'BUTTON_2': 'RIGHT_CLICK'
      };
      keyName = buttonMap[eventData.key] || eventData.key;
      isMouseClick = true;
    }
    
    // Los clics del mouse son eventos EV_KEY (como teclas), no EV_REL
    const eventType = (eventData.type === 'keyboard' || isMouseClick) ? 'EV_KEY' : 'EV_REL';
    const typeHex = (eventData.type === 'keyboard' || isMouseClick) ? '0x01' : '0x02';
    
    const event = {
      timestamp: Date.now(),
      device: eventData.device,
      type: eventType,
      typeHex: typeHex,
      code: eventData.code || 0,
      codeHex: `0x${(eventData.code || 0).toString(16).padStart(4, '0')}`,
      value: eventData.value || 0,
      valueHex: `0x${(eventData.value || 0).toString(16).padStart(8, '0')}`,
      action: eventData.action,
      keyName: keyName,
      scanCode: eventData.scanCode || eventData.code,
      movement: eventData.movement,
      axis: eventData.axis,
      register: {
        port: '0x60',
        dataRegister: '0x60',
        statusRegister: '0x64',
        value: `0x${(eventData.code || 0).toString(16).padStart(2, '0')}`
      },
      source: 'browser' // Indicar que viene del navegador
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Agrega un evento a la lista
   */
  addEvent(event) {
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
  }

  /**
   * Obtiene los eventos recientes
   */
  getRecentEvents(limit = 20) {
    return this.events.slice(0, limit);
  }

  /**
   * Detiene la captura
   */
  stopCapture() {
    this.isCapturing = false;
    if (this.captureProcess) {
      if (this.captureProcess.destroy) {
        this.captureProcess.destroy();
      } else if (this.captureProcess.kill) {
        this.captureProcess.kill();
      }
      this.captureProcess = null;
    }
  }
}

module.exports = RealTimeInputCapture;
