const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const InterruptMonitor = require('./monitors/interrupts');
const IOMonitor = require('./monitors/io');
const RealTimeInputCapture = require('./monitors/realtime-input');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Instanciar monitores
const interruptMonitor = new InterruptMonitor();
const ioMonitor = new IOMonitor();
const inputCapture = new RealTimeInputCapture();

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Ruta API para obtener información del sistema
app.get('/api/system-info', (req, res) => {
  const os = require('os');
  res.json({
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    hostname: os.hostname(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem()
  });
});

// Conexiones WebSocket para datos en tiempo real
wss.on('connection', (ws) => {
  console.log('Cliente conectado');

  // Iniciar captura de eventos reales del hardware
  inputCapture.startCapture((event) => {
    // Enviar evento inmediatamente cuando ocurre
    ws.send(JSON.stringify({
      type: 'realtime-event',
      event: event
    }));
  });

  // Función para enviar datos periódicamente
  const sendData = async () => {
    try {
      // Obtener interrupciones
      const interrupts = await interruptMonitor.getInterrupts();
      
      // Obtener estadísticas de E/S
      const ioStats = await ioMonitor.getIOStats();
      
      // Obtener eventos de input
      const inputEvents = await ioMonitor.getInputEvents();
      
      // Obtener puertos de E/S (solo Linux)
      const ioPorts = await ioMonitor.getIOPorts();

      // Obtener eventos recientes capturados
      const recentEvents = inputCapture.getRecentEvents(20);

      // Enviar todo al cliente
      ws.send(JSON.stringify({
        type: 'update',
        timestamp: Date.now(),
        data: {
          interrupts,
          io: ioStats,
          input: inputEvents,
          ports: ioPorts,
          recentEvents: recentEvents
        }
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  };

  // Recibir eventos del cliente (fallback cuando no hay acceso al hardware)
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'browser-event') {
        const event = inputCapture.addBrowserEvent(data.event);
        // Broadcast a todos los clientes
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'realtime-event',
              event: event
            }));
          }
        });
      }
    } catch (error) {
      console.error('Error procesando mensaje del cliente:', error);
    }
  });

  // Enviar datos inicialmente
  sendData();

  // Enviar actualizaciones cada segundo
  const interval = setInterval(sendData, 1000);

  // Limpiar al desconectar
  ws.on('close', () => {
    console.log('Cliente desconectado');
    clearInterval(interval);
  });

  // Manejar errores
  ws.on('error', (error) => {
    console.error('Error en WebSocket:', error);
    clearInterval(interval);
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Monitor REAL de E/S y Registros del Sistema              ║
╠════════════════════════════════════════════════════════════╣
║  Servidor iniciado en: http://localhost:${PORT}            ║
║                                                            ║
║  Características:                                          ║
║  • Captura REAL de eventos de hardware                    ║
║  • Códigos de scan y valores de registros                 ║
║  • Visualización de puertos 0x60/0x64                     ║
║  • Interrupciones en tiempo real                          ║
║                                                            ║
║  IMPORTANTE:                                               ║
║  ⚠️  En Linux, ejecuta con sudo para captura real:        ║
║     sudo npm start                                         ║
║                                                            ║
║  Sin sudo, capturará eventos desde el navegador           ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Manejo de errores del servidor
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Puerto ${PORT} ya está en uso`);
  } else {
    console.error('Error del servidor:', error);
  }
  process.exit(1);
});

// Manejo de señales para cierre limpio
process.on('SIGINT', () => {
  console.log('\nCerrando servidor...');
  inputCapture.stopCapture();
  server.close(() => {
    console.log('Servidor cerrado');
    process.exit(0);
  });
});
