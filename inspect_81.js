const ExcelJS = require('exceljs');
const path = require('path');

async function inspect81() {
    try {
        const workbook = new ExcelJS.Workbook();
        const filePath = 'c:\\Users\\hesalinas\\Videos\\TERUMO\\ESTATICA\\CALIBRACIONES\\2025 - ELE-8019771.xlsx';
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet('Certificado') || workbook.worksheets[0];

        console.log(`Pestaña: ${worksheet.name}`);
        console.log('--- Fila 10 a 40 (Zona 8.1) ---');
        for (let i = 10; i <= 40; i++) {
            const row = worksheet.getRow(i);
            const values = [];
            for (let j = 1; j <= 12; j++) {
                const cell = row.getCell(j);
                const val = cell.value;
                values.push(`${String.fromCharCode(64 + j)}: ${val ? String(val).substring(0, 20) : '-'}`);
            }
            console.log(`R${i}: ${values.join(' | ')}`);
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

inspect81();
