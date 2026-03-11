#!/bin/bash

# Script de inicio para el Monitor de E/S y Registros del Sistema
# Este script facilita el inicio de la aplicación con diferentes opciones

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Monitor de E/S y Registros del Sistema                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado"
    echo "Por favor instala Node.js desde https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js detectado: $(node --version)"
echo ""

# Verificar si las dependencias están instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    echo ""
fi

# Detectar sistema operativo
OS=$(uname -s)
echo "🖥️  Sistema operativo: $OS"
echo ""

# Mostrar opciones
echo "Opciones de inicio:"
echo ""
echo "1. Modo normal (puerto 3000)"
echo "2. Modo privilegiado con sudo (Linux - acceso completo a /proc)"
echo "3. Puerto personalizado"
echo "4. Modo desarrollo (auto-reload)"
echo ""

read -p "Selecciona una opción (1-4): " option

case $option in
    1)
        echo ""
        echo "🚀 Iniciando servidor en modo normal..."
        echo "📡 Abre http://localhost:3000 en tu navegador"
        echo ""
        npm start
        ;;
    2)
        if [ "$OS" != "Linux" ]; then
            echo ""
            echo "⚠️  Advertencia: Esta opción es óptima para Linux"
            echo "En $OS, los datos de IRQ pueden ser simulados"
            echo ""
        fi
        echo "🚀 Iniciando servidor con privilegios elevados..."
        echo "📡 Abre http://localhost:3000 en tu navegador"
        echo ""
        sudo npm start
        ;;
    3)
        read -p "Ingresa el puerto (ej: 8080): " port
        echo ""
        echo "🚀 Iniciando servidor en puerto $port..."
        echo "📡 Abre http://localhost:$port en tu navegador"
        echo ""
        PORT=$port npm start
        ;;
    4)
        echo ""
        echo "🔧 Iniciando en modo desarrollo..."
        echo "📡 Abre http://localhost:3000 en tu navegador"
        echo "♻️  El servidor se reiniciará automáticamente al detectar cambios"
        echo ""
        npm run dev
        ;;
    *)
        echo ""
        echo "❌ Opción inválida"
        exit 1
        ;;
esac
