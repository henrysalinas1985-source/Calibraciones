document.addEventListener('DOMContentLoaded', () => {
    // === CONFIGURACIÓN Y ESTADO ===
    let db = null;
    let currentWorkbook = null;
    let allSheetsData = {};
    let currentClinic = '';
    let calibrationDates = {}; // { serie: dateString }

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

    async function storeCalibration(serie, date) {
        const tx = db.transaction('calibrations', 'readwrite');
        tx.objectStore('calibrations').put({ serie, date });
    }

    async function getAllCalibrations() {
        return new Promise((resolve) => {
            const tx = db.transaction('calibrations', 'readonly');
            const request = tx.objectStore('calibrations').getAll();
            request.onsuccess = () => {
                const map = {};
                request.result.forEach(item => map[item.serie] = item.date);
                resolve(map);
            };
        });
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
        if (!currentClinic || !allSheetsData[currentClinic]) return;

        calibrationDates = await getAllCalibrations();
        const data = allSheetsData[currentClinic];
        const searchTerm = serieFilter.value.trim().toUpperCase();

        equiposTableBody.innerHTML = '';
        let stats = { total: 0, warning: 0, danger: 0 };

        data.forEach(row => {
            const serieKey = Object.keys(row).find(k => k.toLowerCase().includes('serie'));
            const nombreKey = Object.keys(row).find(k => k.toLowerCase().includes('equipo') || k.toLowerCase().includes('nombre'));

            const serie = String(row[serieKey] || '').toUpperCase();
            if (searchTerm && !serie.includes(searchTerm)) return;

            stats.total++;
            const calibDate = calibrationDates[serie] || null;
            const status = getStatus(calibDate);
            if (status.class === 'status-warning') stats.warning++;
            if (status.class === 'status-danger') stats.danger++;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row[nombreKey] || 'N/A'}</td>
                <td>${serie || 'N/A'}</td>
                <td>${calibDate ? formatDate(calibDate) : '<span style="color:#666">No registrada</span>'}</td>
                <td><span class="status-badge ${status.class}">${status.text}</span></td>
                <td><button class="btn btn-secondary btn-small" onclick="window.openEdit('${serie}', '${calibDate || ''}')">📅</button></td>
            `;
            equiposTableBody.appendChild(tr);
        });

        totalEquiposEl.textContent = stats.total;
        cercaVencerEl.textContent = stats.warning;
        vencidosEl.textContent = stats.danger;
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

        // Hacer la función accesible globalmente para el onclick del HTML
        window.openEdit = (serie, currentDate) => {
            selectedSerieForEdit = serie;
            calibDateInput.value = currentDate || '';
            document.getElementById('modalSerie').textContent = `Serie: ${serie}`;
            editModal.classList.remove('hidden');
        };

        document.getElementById('closeModalBtn').addEventListener('click', () => {
            editModal.classList.add('hidden');
        });

        saveCalibBtn.addEventListener('click', async () => {
            if (!selectedSerieForEdit) return;
            const newDate = calibDateInput.value;
            if (!newDate) return;

            try {
                await storeCalibration(selectedSerieForEdit, newDate);
                editModal.classList.add('hidden');
                renderTable();
            } catch (err) {
                console.error('Error al guardar calibración:', err);
                alert('No se pudo guardar la fecha.');
            }
        });
    }

    // === NOTIFICACIONES ===
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
                const calDateStr = calibrations[serie];

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
