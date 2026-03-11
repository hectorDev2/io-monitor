#!/usr/bin/env python3
"""
Script para eliminar controladores de disco y agregar DMA
"""

# Leer el archivo HTML
with open('public/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Encontrar y marcar las líneas a eliminar
in_ide_section = False
in_sata_section = False
in_nvme_section = False
new_lines = []
skip_until_close = 0

i = 0
while i < len(lines):
    line = lines[i]
    
    # Detectar inicio de sección IDE
    if '<!-- PESTAÑA: IDE/ATA' in line or 'tab-pane" id="tab-ide"' in line:
        in_ide_section = True
        skip_until_close = 0
        i += 1
        continue
    
    # Detectar inicio de sección SATA
    if '<!-- PESTAÑA: SATA' in line or ('tab-pane" id="tab-sata"' in line and not in_ide_section):
        in_sata_section = True
        skip_until_close = 0
        i += 1
        continue
    
    # Detectar inicio de sección NVMe
    if '<!-- PESTAÑA: NVMe' in line or 'tab-pane" id="tab-nvme"' in line:
        in_nvme_section = True
        skip_until_close = 0
        i += 1
        continue
    
    # Detectar fin de secciones de disco
    if (in_ide_section or in_sata_section or in_nvme_section) and '<!-- Fin Pestaña' in line:
        in_ide_section = False
        in_sata_section = False
        in_nvme_section = False
        i += 1
        continue
    
    # Si estamos en una sección de disco, saltarla
    if in_ide_section or in_sata_section or in_nvme_section:
        i += 1
        continue
    
    # Si llegamos aquí, mantener la línea
    new_lines.append(line)
    i += 1

# Encontrar dónde insertar la pestaña DMA (después de Mouse, antes de Interrupciones)
insert_index = -1
for i, line in enumerate(new_lines):
    if '<!-- Fin Pestaña Mouse -->' in line:
        insert_index = i + 1
        break

if insert_index > 0:
    dma_section = '''
                    <!-- ============================================
                         PESTAÑA: DMA (Direct Memory Access)
                         ============================================ -->
                    <div class="tab-pane" id="tab-dma">
                        <div class="controller-section dma-section">
                            <div class="controller-header">
                                <h1 class="controller-title">
                                    <span class="icon">🔄</span>
                                    CONTROLADOR DMA (Direct Memory Access)
                                </h1>
                                <div class="controller-info">
                                    <span class="info-badge">Canales: 8</span>
                                    <span class="info-badge">DMA1: 0x00-0x0F</span>
                                    <span class="info-badge">DMA2: 0xC0-0xDF</span>
                                    <span class="info-badge" id="dmaStatus">Activo</span>
                                </div>
                            </div>

                            <!-- Explicación DMA -->
                            <section class="panel info-panel">
                                <h2>
                                    <span class="icon">💡</span>
                                    ¿Qué es DMA?
                                    <span class="subtitle">Acceso Directo a Memoria</span>
                                </h2>
                                <div class="explanation-box">
                                    <p><strong>DMA permite que los dispositivos transfieran datos directamente a la memoria sin usar la CPU.</strong></p>
                                    <ul class="info-list">
                                        <li>📦 <strong>Sin CPU:</strong> Las transferencias ocurren sin intervención del procesador</li>
                                        <li>⚡ <strong>Más rápido:</strong> Libera a la CPU para otras tareas mientras se transfieren datos</li>
                                        <li>🔢 <strong>8 Canales:</strong> Cada dispositivo puede usar un canal DMA exclusivo</li>
                                        <li>💾 <strong>Memoria directa:</strong> Los datos van directamente del dispositivo a la RAM</li>
                                    </ul>
                                    <div class="example-box">
                                        <strong>Ejemplo:</strong> Cuando lees un archivo del disco, el controlador DMA transfiere los datos 
                                        directamente del disco a la memoria RAM sin que la CPU tenga que copiar cada byte.
                                    </div>
                                </div>
                            </section>

                            <!-- Canales DMA -->
                            <section class="panel dma-channels-panel">
                                <h2>
                                    <span class="icon">🎛️</span>
                                    Canales DMA
                                    <span class="subtitle">Estado de cada canal</span>
                                </h2>
                                <div class="channels-grid">
                                    <!-- Canal 0 -->
                                    <div class="channel-card" id="dma-channel-0">
                                        <div class="channel-header">
                                            <span class="channel-number">Canal 0</span>
                                            <span class="channel-status inactive">Libre</span>
                                        </div>
                                        <div class="channel-info">
                                            <div class="info-row">
                                                <span class="label">Dispositivo:</span>
                                                <span class="value">-</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Transferencias:</span>
                                                <span class="value" id="dma0-transfers">0</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Bytes:</span>
                                                <span class="value" id="dma0-bytes">0 B</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Canal 1 -->
                                    <div class="channel-card" id="dma-channel-1">
                                        <div class="channel-header">
                                            <span class="channel-number">Canal 1</span>
                                            <span class="channel-status inactive">Libre</span>
                                        </div>
                                        <div class="channel-info">
                                            <div class="info-row">
                                                <span class="label">Dispositivo:</span>
                                                <span class="value">-</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Transferencias:</span>
                                                <span class="value" id="dma1-transfers">0</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Bytes:</span>
                                                <span class="value" id="dma1-bytes">0 B</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Canal 2 -->
                                    <div class="channel-card active" id="dma-channel-2">
                                        <div class="channel-header">
                                            <span class="channel-number">Canal 2</span>
                                            <span class="channel-status active">Floppy Disk</span>
                                        </div>
                                        <div class="channel-info">
                                            <div class="info-row">
                                                <span class="label">Dispositivo:</span>
                                                <span class="value">Floppy Controller</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Transferencias:</span>
                                                <span class="value" id="dma2-transfers">152</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Bytes:</span>
                                                <span class="value" id="dma2-bytes">78 KB</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Canal 3 -->
                                    <div class="channel-card" id="dma-channel-3">
                                        <div class="channel-header">
                                            <span class="channel-number">Canal 3</span>
                                            <span class="channel-status inactive">Libre</span>
                                        </div>
                                        <div class="channel-info">
                                            <div class="info-row">
                                                <span class="label">Dispositivo:</span>
                                                <span class="value">-</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Transferencias:</span>
                                                <span class="value" id="dma3-transfers">0</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Bytes:</span>
                                                <span class="value" id="dma3-bytes">0 B</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Canal 4 -->
                                    <div class="channel-card cascade" id="dma-channel-4">
                                        <div class="channel-header">
                                            <span class="channel-number">Canal 4</span>
                                            <span class="channel-status cascade">Cascada</span>
                                        </div>
                                        <div class="channel-info">
                                            <div class="info-row">
                                                <span class="label">Dispositivo:</span>
                                                <span class="value">DMA Cascade</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Función:</span>
                                                <span class="value">Conecta DMA1 con DMA2</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Canal 5 -->
                                    <div class="channel-card active" id="dma-channel-5">
                                        <div class="channel-header">
                                            <span class="channel-number">Canal 5</span>
                                            <span class="channel-status active">Sound Card</span>
                                        </div>
                                        <div class="channel-info">
                                            <div class="info-row">
                                                <span class="label">Dispositivo:</span>
                                                <span class="value">Sound Blaster</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Transferencias:</span>
                                                <span class="value" id="dma5-transfers">3847</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Bytes:</span>
                                                <span class="value" id="dma5-bytes">1.5 MB</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Canal 6 -->
                                    <div class="channel-card" id="dma-channel-6">
                                        <div class="channel-header">
                                            <span class="channel-number">Canal 6</span>
                                            <span class="channel-status inactive">Libre</span>
                                        </div>
                                        <div class="channel-info">
                                            <div class="info-row">
                                                <span class="label">Dispositivo:</span>
                                                <span class="value">-</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Transferencias:</span>
                                                <span class="value" id="dma6-transfers">0</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Bytes:</span>
                                                <span class="value" id="dma6-bytes">0 B</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Canal 7 -->
                                    <div class="channel-card" id="dma-channel-7">
                                        <div class="channel-header">
                                            <span class="channel-number">Canal 7</span>
                                            <span class="channel-status inactive">Libre</span>
                                        </div>
                                        <div class="channel-info">
                                            <div class="info-row">
                                                <span class="label">Dispositivo:</span>
                                                <span class="value">-</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Transferencias:</span>
                                                <span class="value" id="dma7-transfers">0</span>
                                            </div>
                                            <div class="info-row">
                                                <span class="label">Bytes:</span>
                                                <span class="value" id="dma7-bytes">0 B</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <!-- Registros DMA -->
                            <section class="panel registers-panel dma-registers">
                                <h2>
                                    <span class="icon">🔧</span>
                                    Registros del Controlador DMA
                                    <span class="subtitle">Registros principales</span>
                                </h2>
                                <div class="explanation-box">
                                    <p><strong>Los registros DMA controlan cómo se transfieren los datos.</strong> Cada canal tiene sus propios registros para dirección de memoria, contador de bytes, y modo de operación.</p>
                                </div>
                                <div class="registers-grid">
                                    <!-- Address Register -->
                                    <div class="register-box data-register" id="dmaAddressRegister">
                                        <div class="register-header">
                                            <h3>Address Register</h3>
                                            <span class="register-port">Canal 2: 0x04</span>
                                        </div>
                                        <div class="register-value">0x1A40</div>
                                        <div class="register-binary">0001 1010 0100 0000</div>
                                        <div class="register-description">Dirección de memoria para la transferencia</div>
                                        <div class="register-activity"></div>
                                    </div>

                                    <!-- Count Register -->
                                    <div class="register-box status-register" id="dmaCountRegister">
                                        <div class="register-header">
                                            <h3>Count Register</h3>
                                            <span class="register-port">Canal 2: 0x05</span>
                                        </div>
                                        <div class="register-value">0x0200</div>
                                        <div class="register-binary">0000 0010 0000 0000</div>
                                        <div class="register-description">Número de bytes a transferir (512)</div>
                                        <div class="register-activity"></div>
                                    </div>

                                    <!-- Mode Register -->
                                    <div class="register-box command-register" id="dmaModeRegister">
                                        <div class="register-header">
                                            <h3>Mode Register</h3>
                                            <span class="register-port">DMA1: 0x0B</span>
                                        </div>
                                        <div class="register-value">0x46</div>
                                        <div class="register-binary">0100 0110</div>
                                        <div class="register-flags">
                                            <div class="flag flag-active">
                                                <span class="flag-name">READ</span>
                                                <span class="flag-desc">Lectura de memoria</span>
                                            </div>
                                            <div class="flag flag-active">
                                                <span class="flag-name">SINGLE</span>
                                                <span class="flag-desc">Modo single</span>
                                            </div>
                                        </div>
                                        <div class="register-activity"></div>
                                    </div>

                                    <!-- Status Register -->
                                    <div class="register-box control-register" id="dmaStatusRegister">
                                        <div class="register-header">
                                            <h3>Status Register</h3>
                                            <span class="register-port">DMA1: 0x08</span>
                                        </div>
                                        <div class="register-value">0x04</div>
                                        <div class="register-binary">0000 0100</div>
                                        <div class="register-flags">
                                            <div class="flag flag-active">
                                                <span class="flag-name">TC2</span>
                                                <span class="flag-desc">Canal 2 completó transferencia</span>
                                            </div>
                                        </div>
                                        <div class="register-activity"></div>
                                    </div>
                                </div>
                            </section>

                            <!-- Transferencias en tiempo real -->
                            <section class="panel highlight-panel dma-transfers-panel">
                                <h2>
                                    <span class="icon">⚡</span>
                                    Transferencias DMA en Tiempo Real
                                    <span class="subtitle">Operaciones activas</span>
                                </h2>
                                <div class="explanation-box">
                                    <p><strong>Aquí puedes ver las transferencias DMA conforme ocurren.</strong> Cada transferencia muestra qué canal se usó, cuántos bytes se movieron y a qué dirección de memoria.</p>
                                </div>
                                <div class="table-container">
                                    <table id="dmaTransfersTable">
                                        <thead>
                                            <tr>
                                                <th>Tiempo</th>
                                                <th>Canal</th>
                                                <th>Dispositivo</th>
                                                <th>Dirección</th>
                                                <th>Bytes</th>
                                                <th>Modo</th>
                                                <th>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody id="dmaTransfersBody">
                                            <tr>
                                                <td colspan="7" class="loading">🔄 Esperando transferencias DMA...</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>
                    </div>
                    <!-- Fin Pestaña DMA -->

'''
    new_lines.insert(insert_index, dma_section)

# Guardar el archivo modificado
with open('public/index.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✓ Eliminadas pestañas de disco (IDE, SATA, NVMe)")
print("✓ Agregada pestaña de DMA con explicaciones")
