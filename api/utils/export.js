const ExcelJS = require('exceljs');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

async function exportToExcel(data, columns, sheetName = 'Report') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 20,
    }));

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1B5E20' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    data.forEach(row => worksheet.addRow(row));

    return await workbook.xlsx.writeBuffer();
}

function exportToPDF(data, columns, title = 'Report') {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(27, 94, 32);
    doc.text('Glory Pharmacy', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Hola, Tana River County, Kenya', 14, 22);

    // Title
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(title, 14, 35);

    // Date
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

    // Table
    doc.autoTable({
        startY: 48,
        head: [columns.map(c => c.header)],
        body: data.map(row => columns.map(c => row[c.key] ?? '')),
        theme: 'grid',
        headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255] },
        styles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 248, 240] },
    });

    return Buffer.from(doc.output('arraybuffer'));
}

function exportToCSV(data, columns) {
    const header = columns.map(c => c.header).join(',');
    const rows = data.map(row =>
        columns.map(c => {
            const val = row[c.key] ?? '';
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(',')
    );
    return [header, ...rows].join('\n');
}

module.exports = { exportToExcel, exportToPDF, exportToCSV };
