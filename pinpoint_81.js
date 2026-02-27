const ExcelJS = require('exceljs');
const path = require('path');

async function pinpoint81() {
    try {
        const workbook = new ExcelJS.Workbook();
        const filePath = 'c:\\Users\\hesalinas\\Videos\\TERUMO\\ESTATICA\\CALIBRACIONES\\2025 - ELE-8019771.xlsx';
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet('Certificado') || workbook.worksheets[0];

        console.log(`Hoja: ${worksheet.name}`);

        // Buscar "8.1.1" o "Chasis"
        let foundRow = -1;
        for (let i = 1; i <= 100; i++) {
            const row = worksheet.getRow(i);
            for (let j = 1; j <= 10; j++) {
                const val = String(row.getCell(j).value || '');
                if (val.includes('8.1.1') || val.includes('Chasis')) {
                    foundRow = i;
                    console.log(`Found "Chasis" at Row ${i}, Column ${j}`);
                    break;
                }
            }
            if (foundRow !== -1) break;
        }

        if (foundRow !== -1) {
            console.log('\n--- Grid around Chasis ---');
            for (let i = foundRow - 1; i <= foundRow + 18; i++) {
                const row = worksheet.getRow(i);
                let line = `R${i}: `;
                for (let j = 1; j <= 15; j++) {
                    const cell = row.getCell(j);
                    const addr = cell.address;
                    const val = cell.value ? String(cell.value).substring(0, 10) : '-';
                    line += `[${addr}:${val}] `;
                }
                console.log(line);
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

pinpoint81();
