document.addEventListener('DOMContentLoaded', () => {
    // === CONFIGURACIÓN Y ESTADO ===
    let db = null;
    let currentWorkbook = null;
    let allSheetsData = {};
    let currentClinic = '';
    let calibrationDates = {}; // { serie: { date, technician, etc. } }
    let instrumentsBank = []; // Unique instruments for autocomplete

    const DB_NAME = 'CalibracionesDB';
    const DB_VERSION = 1;

    // Elementos DOM
    const fileInput = document.getElementById('fileInput');
    const fileLabel = document.getElementById('fileLabel');
    const mainContent = document.getElementById('mainContent');
    const sheetSelector = document.getElementById('sheetSelector');
    const serieFilter = document.getElementById('serieFilter');
    const equiposTableBody = document.getElementById('equiposTableBody');
    const editModal = document.getElementById('editModal');
    const calibDateInput = document.getElementById('calibDateInput');
    const ordenMInput = document.getElementById('ordenMInput');
    const technicianInput = document.getElementById('technicianInput');
    const brandInput = document.getElementById('brandInput');
    const modelInput = document.getElementById('modelInput');
    const buildingInput = document.getElementById('buildingInput');
    const sectorInput = document.getElementById('sectorInput');
    const locationInput = document.getElementById('locationInput');
    const addInstrumentBtn = document.getElementById('addInstrumentBtn');
    const instrumentsContainer = document.getElementById('instrumentsContainer');
    const certFileInput = document.getElementById('certFileInput');
    const certStatus = document.getElementById('certStatus');
    const saveCalibBtn = document.getElementById('saveCalibBtn');
    const totalEquiposEl = document.getElementById('totalEquipos').querySelector('.val');
    const cercaVencerEl = document.getElementById('cercaVencer').querySelector('.val');
    const vencidosEl = document.getElementById('vencidos').querySelector('.val');

    let selectedSerieForEdit = null;

    // === INICIALIZACIÓN ===
    async function init() {
        try {
            await initDB();
            await loadSavedData();
            setupEventListeners();
            requestNotificationPermission();
        } catch (err) {
            console.error('Error durante la inicialización:', err);
            alert('Error al iniciar la aplicación. Por favor, intenta recargar.');
        }
    }

    // === BASE DE DATOS (IndexedDB) ===
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('calibrations')) {
                    db.createObjectStore('calibrations', { keyPath: 'serie' });
                }
                if (!db.objectStoreNames.contains('appData')) {
                    db.createObjectStore('appData', { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => {
                db = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function storeCalibration(serie, date, technician, ordenM, certificate, building, sector, location, brand, model, instruments) {
        const tx = db.transaction('calibrations', 'readwrite');
        const store = tx.objectStore('calibrations');
        const data = { serie, date, technician, ordenM, building, sector, location, brand, model, instruments };
        if (certificate) {
            data.certificate = certificate; // Blob
            data.certName = certificate.name;
        } else {
            // Mantener el certificado anterior si no se sube uno nuevo
            const existing = await new Promise(resolve => {
                const req = store.get(serie);
                req.onsuccess = () => resolve(req.result);
            });
            if (existing && existing.certificate) {
                data.certificate = existing.certificate;
                data.certName = existing.certName;
            }
        }
        store.put(data);
    }

    function getAllCalibrations() {
        console.log("Obteniendo todas las calibraciones...");
        return new Promise((resolve) => {
            if (!db) {
                console.warn("DB no inicializada.");
                resolve({});
                return;
            }
            const map = {};
            const tx = db.transaction('calibrations', 'readonly');
            const store = tx.objectStore('calibrations');
            const request = store.openCursor();

            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    map[cursor.key] = cursor.value;
                    cursor.continue();
                } else {
                    console.log("Calibraciones cargadas:", Object.keys(map).length);
                    calibrationDates = map;
                    updateInstrumentsBank();
                    resolve(map);
                }
            };
            request.onerror = (e) => {
                console.error("Error al obtener calibraciones:", e.target.error);
                resolve({});
            };
        });
    }

    function updateInstrumentsBank() {
        console.log("Actualizando banco de instrumentos...");
        const unique = new Map();
        try {
            Object.values(calibrationDates).forEach(cal => {
                if (cal && cal.instruments) {
                    cal.instruments.forEach(inst => {
                        if (inst.name && !unique.has(inst.name.trim().toUpperCase())) {
                            unique.set(inst.name.trim().toUpperCase(), {
                                name: inst.name,
                                brand: inst.brand,
                                model: inst.model,
                                serie: inst.serie
                            });
                        }
                    });
                }
            });
            instrumentsBank = Array.from(unique.values());

            const datalist = document.getElementById('instrumentsHistory');
            if (datalist) {
                datalist.innerHTML = '';
                instrumentsBank.forEach(inst => {
                    const opt = document.createElement('option');
                    opt.value = inst.name;
                    datalist.appendChild(opt);
                });
            }
        } catch (err) {
            console.error("Error en updateInstrumentsBank:", err);
        }
    }

    // === LÓGICA DE EXCEL ===
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            processWorkbook(workbook, file.name);
        };
        reader.readAsArrayBuffer(file);
    });

    async function processWorkbook(workbook, filename) {
        currentWorkbook = workbook;
        allSheetsData = {};
        sheetSelector.innerHTML = '';

        workbook.SheetNames.forEach(name => {
            const sheet = workbook.Sheets[name];
            const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            // Limpiar filas vacías y columnas __EMPTY
            const cleaned = json.map(row => {
                const newRow = {};
                Object.keys(row).filter(k => !k.startsWith('__EMPTY')).forEach(k => {
                    newRow[k] = row[k];
                });
                return newRow;
            }).filter(row => Object.values(row).some(v => v !== ""));

            allSheetsData[name] = cleaned;

            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            sheetSelector.appendChild(option);
        });

        currentClinic = workbook.SheetNames[0];
        fileLabel.textContent = `✅ ${filename}`;

        // Guardar en IndexedDB
        const tx = db.transaction('appData', 'readwrite');
        tx.objectStore('appData').put({
            id: 'lastExcel',
            filename,
            allSheetsData,
            sheetNames: workbook.SheetNames,
            currentClinic
        });

        mainContent.classList.remove('hidden');
        document.getElementById('configActions').classList.remove('hidden');
        renderTable();
    }

    async function loadSavedData() {
        if (!db) await initDB();
        const tx = db.transaction('appData', 'readonly');
        const lastExcel = await new Promise(resolve => {
            const req = tx.objectStore('appData').get('lastExcel');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });

        if (lastExcel) {
            allSheetsData = lastExcel.allSheetsData;
            currentClinic = lastExcel.currentClinic;

            sheetSelector.innerHTML = '';
            lastExcel.sheetNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                if (name === currentClinic) option.selected = true;
                sheetSelector.appendChild(option);
            });

            fileLabel.textContent = `✅ ${lastExcel.filename} (Recuperado)`;
            mainContent.classList.remove('hidden');
            document.getElementById('configActions').classList.remove('hidden');
            renderTable();
        }
    }

    document.getElementById('clearDataBtn').addEventListener('click', async () => {
        if (confirm('¿Deseas borrar los datos cargados?')) {
            const tx = db.transaction('appData', 'readwrite');
            tx.objectStore('appData').delete('lastExcel');
            location.reload();
        }
    });

    // === RENDERIZADO ===
    async function renderTable() {
        console.log("Renderizando tabla para:", currentClinic);
        if (!currentClinic || !allSheetsData[currentClinic]) {
            console.warn("Faltan datos de hoja o clínica.");
            return;
        }

        await getAllCalibrations();
        const data = allSheetsData[currentClinic];
        const searchTerm = serieFilter.value.trim().toUpperCase();

        equiposTableBody.innerHTML = '';
        let stats = { total: 0, warning: 0, danger: 0 };

        console.log("Filas a procesar:", data.length);

        data.forEach(row => {
            try {
                const keys = Object.keys(row);
                const serieKey = keys.find(k => k.toLowerCase().includes('serie'));
                const nombreKey = keys.find(k => k.toLowerCase().includes('equipo') || k.toLowerCase().includes('nombre'));

                const serie = serieKey ? String(row[serieKey] || '').toUpperCase() : 'N/A';
                if (searchTerm && !serie.includes(searchTerm)) return;

                stats.total++;
                const calibObj = calibrationDates[serie] || null;
                const calibDate = calibObj ? calibObj.date : null;
                const status = getStatus(calibDate);

                if (status.class === 'status-warning') stats.warning++;
                if (status.class === 'status-danger') stats.danger++;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${nombreKey ? (row[nombreKey] || 'N/A') : 'N/A'}</td>
                    <td>${serie}</td>
                    <td>${calibDate ? formatDate(calibDate) : '<span style="color:#666">No registrada</span>'}</td>
                    <td>${calibObj && calibObj.technician ? calibObj.technician : '-'}</td>
                    <td>
                        ${calibObj && calibObj.certificate ?
                        `<button class="btn btn-small" title="Ver Certificado" onclick="window.viewCert('${serie}')">📄</button>` :
                        '-'}
                    </td>
                    <td><span class="status-badge ${status.class}">${status.text}</span></td>
                    <td><button class="btn btn-secondary btn-small" onclick="window.openEdit('${serie}')">📅</button></td>
                `;
                equiposTableBody.appendChild(tr);
            } catch (err) {
                console.error("Error procesando fila:", err, row);
            }
        });

        totalEquiposEl.textContent = stats.total;
        cercaVencerEl.textContent = stats.warning;
        vencidosEl.textContent = stats.danger;
        console.log("Render completo. Total:", stats.total);
    }

    function getStatus(dateStr) {
        if (!dateStr) return { text: 'Pendiente', class: '' };

        const calDate = new Date(dateStr);
        const nextCal = new Date(calDate);
        nextCal.setFullYear(nextCal.getFullYear() + 1); // Asumimos 1 año de vigencia

        const now = new Date();
        const diffDays = Math.ceil((nextCal - now) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: 'Vencido', class: 'status-danger' };
        if (diffDays <= 30) return { text: `Vence en ${diffDays}d`, class: 'status-warning' };
        return { text: 'Vigente', class: 'status-ok' };
    }

    function createInstrumentRow(data = {}) {
        const div = document.createElement('div');
        div.className = 'instrument-item';
        div.innerHTML = `
            <button type="button" class="remove-instrument" title="Eliminar instrumento">×</button>
            <div class="field-group full-width">
                <label>Nombre del Instrumental</label>
                <input type="text" class="inst-name" placeholder="Ej: MULTIPARAMETRICO SIMULADOR" list="instrumentsHistory" value="${data.name || ''}">
            </div>
            <div class="field-group">
                <label>Marca</label>
                <input type="text" class="inst-brand" placeholder="Marca" value="${data.brand || ''}">
            </div>
            <div class="field-group">
                <label>Modelo</label>
                <input type="text" class="inst-model" placeholder="Modelo" value="${data.model || ''}">
            </div>
            <div class="field-group">
                <label>N° de Serie</label>
                <input type="text" class="inst-serie" placeholder="N° de serie" value="${data.serie || ''}">
            </div>
            <div class="field-group">
                <label>Últ. Calibración</label>
                <input type="text" class="inst-date" placeholder="DD/MM/YYYY" value="${data.date || ''}">
            </div>
        `;

        const nameInput = div.querySelector('.inst-name');
        nameInput.onchange = () => {
            const val = nameInput.value.trim().toUpperCase();
            const found = instrumentsBank.find(i => i.name.toUpperCase() === val);
            if (found) {
                div.querySelector('.inst-brand').value = found.brand || '';
                div.querySelector('.inst-model').value = found.model || '';
                div.querySelector('.inst-serie').value = found.serie || '';
            }
        };

        div.querySelector('.remove-instrument').onclick = () => div.remove();
        instrumentsContainer.appendChild(div);
    }

    addInstrumentBtn.onclick = () => createInstrumentRow();

    function getInstrumentsData() {
        return Array.from(instrumentsContainer.querySelectorAll('.instrument-item')).map(row => ({
            name: row.querySelector('.inst-name').value,
            brand: row.querySelector('.inst-brand').value,
            model: row.querySelector('.inst-model').value,
            serie: row.querySelector('.inst-serie').value,
            date: row.querySelector('.inst-date').value
        }));
    }

    // === EVENTOS ===
    function setupEventListeners() {
        // Mejorar la interacción de carga: clic en la zona dispara el input
        const dropZone = document.getElementById('dropZone');
        dropZone.addEventListener('click', () => fileInput.click());

        sheetSelector.addEventListener('change', (e) => {
            currentClinic = e.target.value;
            renderTable();
        });

        serieFilter.addEventListener('input', renderTable);

        // Forzar apertura del selector de fecha al hacer clic en el input
        calibDateInput.addEventListener('click', () => {
            try {
                if (calibDateInput.showPicker) calibDateInput.showPicker();
            } catch (e) {
                console.log('showPicker not supported');
            }
        });

        // Hacer la función accesible globalmente para el onclick del HTML
        window.openEdit = (serie) => {
            selectedSerieForEdit = serie;
            const existing = calibrationDates[serie] || {};

            // Buscar datos base del equipo para pre-llenar si no hay guardados
            const equipmentData = (allSheetsData[currentClinic] || []).find(row => {
                const k = Object.keys(row).find(key => key.toLowerCase().includes('serie'));
                return String(row[k] || '').toUpperCase() === serie;
            }) || {};

            const getVal = (row, words) => {
                const key = Object.keys(row).find(k => words.some(w => k.toLowerCase().includes(w)));
                return row[key] || '';
            };

            calibDateInput.value = existing.date || '';
            ordenMInput.value = existing.ordenM || '';
            technicianInput.value = existing.technician || '';

            // Prioridad: 1. Datos guardados (ediciones previas) 2. Datos del Excel base
            buildingInput.value = existing.building || getVal(equipmentData, ['edificio']);
            sectorInput.value = existing.sector || getVal(equipmentData, ['sector']);
            locationInput.value = existing.location || getVal(equipmentData, ['ubicación', 'ubicacion']);

            // Marca y Modelo
            brandInput.value = existing.brand || getVal(equipmentData, ['marca']);
            modelInput.value = existing.model || getVal(equipmentData, ['modelo']);

            // Limpiar y cargar instrumentos
            instrumentsContainer.innerHTML = '';
            if (existing.instruments && existing.instruments.length > 0) {
                existing.instruments.forEach(inst => createInstrumentRow(inst));
            }

            certFileInput.value = ''; // Limpiar input file
            certStatus.textContent = existing.certName ? `Certificado actual: ${existing.certName}` : 'Sin certificado adjunto';
            document.getElementById('modalSerie').textContent = `Serie: ${serie}`;
            editModal.classList.remove('hidden');
        };

        window.viewCert = (serie) => {
            const data = calibrationDates[serie];
            if (data && data.certificate) {
                const url = URL.createObjectURL(data.certificate);
                window.open(url, '_blank');
                // Nota: Sería ideal revocar el URL eventualmente, pero para visualización rápida así funciona
            }
        };

        document.getElementById('closeModalBtn').addEventListener('click', () => {
            editModal.classList.add('hidden');
        });

        saveCalibBtn.addEventListener('click', async () => {
            if (!selectedSerieForEdit) return;
            const newDate = calibDateInput.value;
            const ordenM = ordenMInput.value;
            const technician = technicianInput.value;
            const building = buildingInput.value;
            const sector = sectorInput.value;
            const location = locationInput.value;
            const brand = brandInput.value;
            const model = modelInput.value;
            const instruments = getInstrumentsData();
            let certificate = certFileInput.files[0] || null;

            if (!newDate) {
                alert('Por favor selecciona una fecha de calibración.');
                return;
            }

            try {
                const equipmentData = (allSheetsData[currentClinic] || []).find(row => {
                    const k = Object.keys(row).find(key => key.toLowerCase().includes('serie'));
                    return String(row[k] || '').toUpperCase() === selectedSerieForEdit;
                });

                const existingData = calibrationDates[selectedSerieForEdit] || {};
                let certToUpdate = certificate || existingData.certificate;
                let certName = certificate ? certificate.name : existingData.certName;

                if (certToUpdate && (certName.toLowerCase().endsWith('.xlsx') || certName.toLowerCase().endsWith('.xls'))) {
                    certificate = await updateExcelCertificate(certToUpdate, {
                        date: newDate,
                        technician: technician,
                        ordenM: ordenM,
                        equipment: equipmentData,
                        building: building,
                        sector: sector,
                        location: location,
                        brand: brand,
                        model: model,
                        instruments: instruments
                    });
                }

                await storeCalibration(selectedSerieForEdit, newDate, technician, ordenM, certificate, building, sector, location, brand, model, instruments);
                calibrationDates[selectedSerieForEdit] = { date: newDate, technician, ordenM, certificate, building, sector, location, brand, model, instruments };
                updateInstrumentsBank();

                editModal.classList.add('hidden');
                renderTable();
            } catch (err) {
                console.error('Error al guardar calibración:', err);
                alert('Error al guardar: ' + err.message);
            }
        });
    }

    // === EXCEL MANIPULATION (Using ExcelJS to preserve styles) ===
    async function updateExcelCertificate(originalBlob, data) {
        try {
            const arrayBuffer = await originalBlob.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.worksheets[0];

            if (!worksheet) {
                throw new Error('No se encontró la primera hoja en el certificado.');
            }

            const getVal = (row, words) => {
                if (!row) return '';
                const key = Object.keys(row).find(k => words.some(w => k.toLowerCase().includes(w)));
                return row[key] || '';
            };

            const eq = data.equipment || {};
            const eqName = (getVal(eq, ['equipo', 'nombre']) || '').toUpperCase();

            // Configuración de Mapeos Dinámicos
            const CONFIG_TEMPLATES = {
                'ELECTROCARDIOGRAFO': {
                    cells: {
                        'brand': 'D7',
                        'model': 'D5',
                        'serie': 'A7',
                        'equipment': 'A5',
                        'building': 'H5',
                        'sector': 'H6',
                        'location': 'H7',
                        'date': 'H8',
                        'ordenM': 'H9',
                        'technician': 'H10'
                    },
                    instrumentsStartRow: 12,
                    instrumentsMaxRows: 4
                },
                'DEFAULT': {
                    cells: {
                        'brand': 'D7',
                        'model': 'D5',
                        'serie': 'A7',
                        'equipment': 'A5',
                        'building': 'H5',
                        'sector': 'H6',
                        'location': 'H7',
                        'date': 'H8',
                        'ordenM': 'H9',
                        'technician': 'H10'
                    },
                    instrumentsStartRow: 12,
                    instrumentsMaxRows: 5
                }
            };

            // Detectar plantilla
            const type = Object.keys(CONFIG_TEMPLATES).find(key => eqName.includes(key)) || 'DEFAULT';
            const config = CONFIG_TEMPLATES[type];
            const c = config.cells;

            console.log(`Aplicando plantilla tipo: ${type}`);

            // 1. Actualizar Datos del Equipo y Generales
            const updates = {
                [c.equipment]: `Equipo: ${getVal(eq, ['equipo', 'nombre'])}`,
                [c.model]: `Modelo: ${data.model || ''}`,
                [c.serie]: `N° serie: ${selectedSerieForEdit}`,
                [c.brand]: `Marca: ${data.brand || ''}`,
                [c.building]: String(data.building || ''),
                [c.sector]: String(data.sector || ''),
                [c.location]: String(data.location || ''),
                [c.date]: formatDate(data.date),
                [c.ordenM]: String(data.ordenM || ''),
                [c.technician]: String(data.technician || '')
            };

            for (const [cellPos, value] of Object.entries(updates)) {
                if (!cellPos) continue;
                const cell = worksheet.getCell(cellPos);
                const currentStyle = cell.style;
                cell.value = value;
                cell.style = currentStyle;
            }

            // 2. Inyectar instrumentos
            if (data.instruments && data.instruments.length > 0) {
                data.instruments.forEach((inst, index) => {
                    const row = config.instrumentsStartRow + index;
                    if (index < config.instrumentsMaxRows) {
                        worksheet.getCell(`A${row}`).value = inst.name || '';
                        worksheet.getCell(`B${row}`).value = inst.brand || '';
                        worksheet.getCell(`C${row}`).value = inst.model || '';
                        worksheet.getCell(`D${row}`).value = inst.serie || '';
                        worksheet.getCell(`E${row}`).value = inst.date || '';
                    }
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        } catch (err) {
            console.error('Error en updateExcelCertificate:', err);
            throw err;
        }
    }

    function requestNotificationPermission() {
        if ('Notification' in window) {
            Notification.requestPermission();
        }
    }

    // === UTILIDADES ===
    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    async function checkExpirations() {
        if (!allSheetsData || Object.keys(allSheetsData).length === 0) return;

        const calibrations = await getAllCalibrations();
        const now = new Date();
        const expirations = [];

        Object.keys(allSheetsData).forEach(clinic => {
            allSheetsData[clinic].forEach(row => {
                const serieKey = Object.keys(row).find(k => k.toLowerCase().includes('serie'));
                const serie = String(row[serieKey] || '').toUpperCase();
                const calibObj = calibrations[serie];
                const calDateStr = calibObj ? calibObj.date : null;

                if (calDateStr) {
                    const calDate = new Date(calDateStr);
                    const nextCal = new Date(calDate);
                    nextCal.setFullYear(nextCal.getFullYear() + 1);

                    const diffDays = Math.ceil((nextCal - now) / (1000 * 60 * 60 * 24));

                    if (diffDays <= 30 && diffDays > 0) {
                        expirations.push({ serie, clinic, days: diffDays });
                    } else if (diffDays <= 0) {
                        expirations.push({ serie, clinic, expired: true });
                    }
                }
            });
        });

        if (expirations.length > 0) {
            const expiredCount = expirations.filter(e => e.expired).length;
            const soonCount = expirations.filter(e => !e.expired).length;

            if (Notification.permission === 'granted') {
                new Notification('Alerta de Calibración', {
                    body: `Hay ${expiredCount} equipos vencidos y ${soonCount} por vencer próximamente.`,
                    icon: '../favicon.ico'
                });
            }
        }
    }

    // Ejecutar chequeo al cargar
    setTimeout(checkExpirations, 2000);

    init();
});
