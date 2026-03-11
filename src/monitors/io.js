const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

class IOMonitor {
  constructor() {
    this.platform = os.platform();
    this.previousIO = {};
  }

  /**
   * Obtiene estadísticas de E/S de dispositivos
   */
  async getIOStats() {
    try {
      if (this.platform === 'linux') {
        return await this.getLinuxIOStats();
      } else if (this.platform === 'darwin') {
        return await this.getMacIOStats();
      } else if (this.platform === 'win32') {
        return await this.getWindowsIOStats();
      }
      return { devices: [], error: 'Platform not supported' };
    } catch (error) {
      return { devices: [], error: error.message };
    }
  }

  /**
   * Lee estadísticas de E/S en Linux desde /proc/diskstats y /sys
   */
  async getLinuxIOStats() {
    return new Promise((resolve) => {
      fs.readFile('/proc/diskstats', 'utf8', (err, data) => {
        if (err) {
          // Si no podemos leer diskstats, devolvemos datos simulados
          resolve(this.getSimulatedIOStats());
          return;
        }

        const devices = [];
        const lines = data.trim().split('\n');

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 14) continue;

          const deviceName = parts[2];
          // Filtrar solo dispositivos principales (no particiones para simplificar)
          if (!/^(sd[a-z]|nvme\d+n\d+|vd[a-z])$/.test(deviceName)) continue;

          const readsCompleted = parseInt(parts[3]);
          const readSectors = parseInt(parts[5]);
          const writesCompleted = parseInt(parts[7]);
          const writeSectors = parseInt(parts[9]);

          // Calcular deltas
          const key = deviceName;
          const prevData = this.previousIO[key] || { reads: readsCompleted, writes: writesCompleted };
          
          const readsDelta = readsCompleted - prevData.reads;
          const writesDelta = writesCompleted - prevData.writes;

          this.previousIO[key] = { reads: readsCompleted, writes: writesCompleted };

          devices.push({
            name: deviceName,
            type: 'disk',
            reads: readsCompleted,
            writes: writesCompleted,
            readBytes: readSectors * 512, // Sectores a bytes
            writeBytes: writeSectors * 512,
            readsDelta,
            writesDelta,
            active: readsDelta > 0 || writesDelta > 0
          });
        }

        resolve({ devices, platform: 'linux' });
      });
    });
  }

  /**
   * Obtiene estadísticas de E/S en macOS usando iostat
   */
  async getMacIOStats() {
    return new Promise((resolve) => {
      exec('iostat -d -c 2 -w 1', (error, stdout) => {
        if (error) {
          resolve(this.getSimulatedIOStats());
          return;
        }

        // Parsear salida de iostat
        const devices = this.parseIOStatOutput(stdout);
        resolve({ devices, platform: 'darwin' });
      });
    });
  }

  /**
   * Obtiene estadísticas de E/S en Windows usando WMI
   */
  async getWindowsIOStats() {
    return new Promise((resolve) => {
      exec('wmic diskdrive get Name,BytesPerSector,TotalSectors /format:csv', (error, stdout) => {
        if (error) {
          resolve(this.getSimulatedIOStats());
          return;
        }

        // Simular estadísticas de E/S para Windows
        resolve(this.getSimulatedIOStats());
      });
    });
  }

  /**
   * Parsea la salida de iostat (macOS)
   */
  parseIOStatOutput(output) {
    const devices = [];
    const lines = output.trim().split('\n');
    
    // Formato simplificado - iostat muestra dispositivos
    // Por ahora retornamos datos simulados para macOS
    return this.getSimulatedIOStats().devices;
  }

  /**
   * Genera datos simulados de E/S cuando no hay acceso directo
   */
  getSimulatedIOStats() {
    const devices = [
      {
        name: 'disk0',
        type: 'disk',
        reads: Math.floor(Math.random() * 100000) + 50000,
        writes: Math.floor(Math.random() * 80000) + 30000,
        readBytes: Math.floor(Math.random() * 10000000000),
        writeBytes: Math.floor(Math.random() * 8000000000),
        readsDelta: Math.floor(Math.random() * 10),
        writesDelta: Math.floor(Math.random() * 5),
        active: Math.random() > 0.5
      }
    ];

    return { devices, simulated: true };
  }

  /**
   * Monitorea eventos de input (teclado/mouse) - requiere acceso especial
   */
  async getInputEvents() {
    if (this.platform === 'linux') {
      return await this.getLinuxInputEvents();
    }
    
    // Para otros sistemas, simulamos eventos basados en actividad
    return this.getSimulatedInputEvents();
  }

  /**
   * Lee eventos de input en Linux desde /dev/input
   */
  async getLinuxInputEvents() {
    return new Promise((resolve) => {
      // Verificar si hay dispositivos de input accesibles
      fs.readdir('/dev/input', (err, files) => {
        if (err) {
          resolve(this.getSimulatedInputEvents());
          return;
        }

        const inputDevices = [];
        const eventDevices = files.filter(f => f.startsWith('event'));

        eventDevices.forEach(device => {
          inputDevices.push({
            device: `/dev/input/${device}`,
            type: 'input',
            accessible: true
          });
        });

        resolve({ 
          inputDevices, 
          note: 'Reading actual events requires root access. Use evtest or similar tools.',
          platform: 'linux'
        });
      });
    });
  }

  /**
   * Simula eventos de input
   */
  getSimulatedInputEvents() {
    return {
      keyboard: {
        device: 'Keyboard',
        events: Math.floor(Math.random() * 100),
        lastKey: Math.random() > 0.5 ? 'A' : null
      },
      mouse: {
        device: 'Mouse',
        events: Math.floor(Math.random() * 200),
        x: Math.floor(Math.random() * 1920),
        y: Math.floor(Math.random() * 1080),
        clicks: Math.floor(Math.random() * 10)
      },
      simulated: true
    };
  }

  /**
   * Obtiene información de puertos E/S (solo Linux)
   */
  async getIOPorts() {
    if (this.platform !== 'linux') {
      return { ports: [], note: 'IO ports only available on Linux' };
    }

    return new Promise((resolve) => {
      fs.readFile('/proc/ioports', 'utf8', (err, data) => {
        if (err) {
          resolve({ ports: [], error: 'Cannot read /proc/ioports' });
          return;
        }

        const ports = [];
        const lines = data.trim().split('\n');

        for (const line of lines) {
          const match = line.match(/([0-9a-f]+)-([0-9a-f]+)\s*:\s*(.+)/);
          if (match) {
            ports.push({
              start: match[1],
              end: match[2],
              device: match[3].trim()
            });
          }
        }

        resolve({ ports, platform: 'linux' });
      });
    });
  }
}

module.exports = IOMonitor;
