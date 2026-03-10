const ExcelJS = require('exceljs');
const path = require('path');

async function inspectTemplate() {
    const workbook = new ExcelJS.Workbook();
    const filePath = path.join('c:', 'Users', 'hesalinas', 'Videos', 'TERUMO', 'ESTATICA', 'CALIBRACIONES', '2025 - ELE-8019771.xlsx');

    try {
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];

        console.log(`Sheet Name: ${worksheet.name}`);

        const rowsToCheck = [1, 5, 7, 12, 16, 35, 36, 40, 41, 45, 46, 51, 52, 53, 54, 55, 56, 57];

        rowsToCheck.forEach(rowIdx => {
            const row = worksheet.getRow(rowIdx);
            const values = row.values.slice(1, 11); // Col A to J
            console.log(`Row ${rowIdx}: ${JSON.stringify(values)}`);
        });

    } catch (err) {
        console.error('Error reading file:', err);
    }
}

inspectTemplate();
