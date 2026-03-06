document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const classFilter = document.getElementById('classFilter');
    const totalEquipos = document.getElementById('totalEquipos');
    const totalTipos = document.getElementById('totalTipos');
    const upcomingCalibrations = document.getElementById('upcomingCalibrations');
    const totalEquiposCard = document.getElementById('totalEquiposCard');
    const upcomingCalibrationsCard = document.getElementById('upcomingCalibrationsCard');

    let allData = [];
    let showOnlyAlerts = false;

    // Cargar datos
    function loadData() {
        try {
            allData = equipmentData;
            populateCategories(allData);
            applyFilters();
            updateStats(allData);
        } catch (error) {
            console.error('Error:', error);
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: red; padding: 2rem;">Error al cargar los datos.</td></tr>`;
        }
    }

    function parseDate(dateStr) {
        if (!dateStr || dateStr === 'N/A') return null;
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
    }

    function isUpcoming(dateStr) {
        const calDate = parseDate(dateStr);
        if (!calDate) return false;

        const nextCal = new Date(calDate);
        nextCal.setFullYear(nextCal.getFullYear() + 1); // Vigencia de 1 año

        const now = new Date();
        const diffTime = nextCal - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Alerta si vence en los próximos 90 días (mes actual + 2 meses de proximidad)
        return diffDays > 0 && diffDays <= 90;
    }

    function populateCategories(data) {
        const categories = [...new Set(data.map(i => i.Equipo))].sort();
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            classFilter.appendChild(option);
        });
    }

    function applyFilters() {
        const term = searchInput.value.toLowerCase();
        const selectedClass = classFilter.value;

        let filtered = allData.filter(item => {
            const matchesSearch = item.Serie.toLowerCase().includes(term) || item.Fecha.toLowerCase().includes(term);
            const matchesClass = selectedClass === 'all' || item.Equipo === selectedClass;
            const matchesAlert = !showOnlyAlerts || isUpcoming(item.Fecha);
            return matchesSearch && matchesClass && matchesAlert;
        });

        // Ordenar por clase de equipo si el filtro de alertas está activo
        if (showOnlyAlerts) {
            filtered.sort((a, b) => a.Equipo.localeCompare(b.Equipo));
        }

        renderTable(filtered);
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 2rem;">No se encontraron resultados.</td></tr>`;
            return;
        }
        data.forEach(item => {
            const tr = document.createElement('tr');
            const alertClass = isUpcoming(item.Fecha) ? 'badge-alert' : '';
            tr.innerHTML = `
                <td><span class="badge badge-equipo">${item.Equipo}</span></td>
                <td><span class="serie-text">${item.Serie}</span></td>
                <td><span class="badge badge-date ${alertClass}">${item.Fecha}</span></td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function updateStats(data) {
        totalEquipos.textContent = data.length;
        const types = new Set(data.map(i => i.Equipo));
        totalTipos.textContent = types.size;

        const alertCount = data.filter(i => isUpcoming(i.Fecha)).length;
        upcomingCalibrations.textContent = alertCount;
    }

    searchInput.addEventListener('input', applyFilters);
    classFilter.addEventListener('change', applyFilters);

    upcomingCalibrationsCard.addEventListener('click', () => {
        showOnlyAlerts = !showOnlyAlerts;
        upcomingCalibrationsCard.classList.toggle('active-filter', showOnlyAlerts);
        totalEquiposCard.classList.remove('active-filter');
        applyFilters();
    });

    totalEquiposCard.addEventListener('click', () => {
        showOnlyAlerts = false;
        upcomingCalibrationsCard.classList.remove('active-filter');
        totalEquiposCard.classList.add('active-filter');
        searchInput.value = '';
        classFilter.value = 'all';
        applyFilters();
    });

    loadData();
});
