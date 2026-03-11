const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

class InterruptMonitor {
  constructor() {
    this.platform = os.platform();
    this.previousStats = {};
  }

  /**
   * Captura interrupciones del sistema en tiempo real
   */
  async getInterrupts() {
    try {
      if (this.platform === 'linux') {
        return await this.getLinuxInterrupts();
      } else if (this.platform === 'darwin') {
        return await this.getMacInterrupts();
      } else if (this.platform === 'win32') {
        return await this.getWindowsInterrupts();
      }
      return { interrupts: [], error: 'Platform not supported' };
    } catch (error) {
      return { interrupts: [], error: error.message };
    }
  }

  /**
   * Lee /proc/interrupts en Linux para obtener IRQs reales
   */
  async getLinuxInterrupts() {
    return new Promise((resolve) => {
      fs.readFile('/proc/interrupts', 'utf8', (err, data) => {
        if (err) {
          resolve({ interrupts: [], error: 'Cannot read /proc/interrupts. Try running with sudo.' });
          return;
        }

        const lines = data.trim().split('\n');
        const interrupts = [];
        
        // Primera línea contiene los nombres de CPUs
        const cpuCount = lines[0].trim().split(/\s+/).length;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(/\s+/);
          const irq = parts[0].replace(':', '');
          
          // Sumar interrupciones de todas las CPUs
          let total = 0;
          for (let j = 1; j <= cpuCount; j++) {
            const val = parseInt(parts[j]) || 0;
            total += val;
          }

          // Nombre del dispositivo
          const device = parts.slice(cpuCount + 1).join(' ');

          // Calcular delta desde última lectura
          const delta = this.previousStats[irq] ? total - this.previousStats[irq] : 0;
          this.previousStats[irq] = total;

          interrupts.push({
            irq,
            count: total,
            delta,
            device: device || 'Unknown',
            type: this.getInterruptType(device)
          });
        }

        resolve({ interrupts, platform: 'linux' });
      });
    });
  }

  /**
   * Obtiene interrupciones en macOS usando iostat y otras herramientas
   */
  async getMacInterrupts() {
    return { interrupts: [], error: 'macOS not supported. Use Linux for real interrupt monitoring.' };
  }

  /**
   * Obtiene interrupciones en Windows usando WMI
   */
  async getWindowsInterrupts() {
    return { interrupts: [], error: 'Windows not supported. Use Linux for real interrupt monitoring.' };
  }

  /**
   * Determina el tipo de interrupción basado en el dispositivo
   */
  getInterruptType(device) {
    const deviceLower = device.toLowerCase();
    
    if (deviceLower.includes('keyboard') || deviceLower.includes('i8042')) {
      return 'keyboard';
    } else if (deviceLower.includes('mouse') || deviceLower.includes('ps/2')) {
      return 'mouse';
    } else if (deviceLower.includes('disk') || deviceLower.includes('sata') || deviceLower.includes('nvme') || deviceLower.includes('ahci')) {
      return 'disk';
    } else if (deviceLower.includes('network') || deviceLower.includes('eth') || deviceLower.includes('wifi')) {
      return 'network';
    } else if (deviceLower.includes('usb')) {
      return 'usb';
    } else if (deviceLower.includes('vga') || deviceLower.includes('display') || deviceLower.includes('graphics')) {
      return 'display';
    } else if (deviceLower.includes('timer')) {
      return 'timer';
    }
    
    return 'other';
  }
}

module.exports = InterruptMonitor;
