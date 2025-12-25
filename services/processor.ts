import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { OrderRow } from '../types';
import { 
  detectSeparator, 
  letterToIndex, 
  fixComuna, 
  toDMY, 
  moneyDigitsText, 
  moneyIntEnhoy, 
  getTimestamp 
} from '../utils/helpers';

export interface GeneratedFile {
  blob: Blob;
  filename: string;
}

export const processCSV = async (file: File, userName: string): Promise<{ files: GeneratedFile[]; stats: any }> => {
  const text = await file.text();
  const sep = detectSeparator(text);

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      delimiter: sep,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as string[][];
        if (data.length < 1) {
          return reject(new Error("El archivo CSV está vacío"));
        }

        const mappings = {
          B: letterToIndex('B'),
          C: letterToIndex('C'),
          D: letterToIndex('D'),
          E: letterToIndex('E'),
          K: letterToIndex('K'),
          L: letterToIndex('L'),
          O: letterToIndex('O'),
          Q: letterToIndex('Q'),
          AH: letterToIndex('AH'),
          BB: letterToIndex('BB'),
          BC: letterToIndex('BC'),
          BD: letterToIndex('BD')
        };

        const zmOrders: OrderRow[] = [];
        const enhoyOrders: OrderRow[] = [];

        data.forEach((row) => {
          const status = (row[mappings.Q] || '').trim().toUpperCase();
          if (status === 'EMBALAR-ZM' || status === 'EMBALAR-ENHOY') {
            const mapped: OrderRow = {
              fecha: toDMY(row[mappings.B]),
              destinatario: (row[mappings.C] || '').trim(),
              direccion: (row[mappings.D] || '').trim(),
              comuna: fixComuna(row[mappings.E]),
              monto: row[mappings.K] || '',
              telefono: (row[mappings.L] || '').trim(),
              tracking: (row[mappings.O] || '').trim(),
              estado: status,
              observaciones: (row[mappings.AH] || '').trim(),
              reversa: (row[mappings.BB] || '').trim(),
              referencia: (row[mappings.BC] || '').trim(),
              pedidoNombre: (row[mappings.BD] || '').trim() || (row[mappings.C] || '').trim()
            };
            if (status === 'EMBALAR-ZM') zmOrders.push(mapped);
            else enhoyOrders.push(mapped);
          }
        });

        if (zmOrders.length === 0 && enhoyOrders.length === 0) {
          return reject(new Error("No se encontraron pedidos con estado EMBALAR-ZM o EMBALAR-ENHOY"));
        }

        const generatedFiles: GeneratedFile[] = [];
        const timestamp = getTimestamp();

        // 1. ZM XLSX Generation
        if (zmOrders.length > 0) {
          const zmData = zmOrders.map(o => ({
            "Numero de tracking": o.tracking,
            "Fecha de venta": o.fecha,
            "Destinatario": o.destinatario,
            "Teléfono de contacto": o.telefono,
            "Dirección": o.direccion,
            "Comuna": o.comuna,
            "Observaciones": o.observaciones,
            "Referencia": o.referencia,
            "4 Total a pagar": moneyDigitsText(o.monto),
            "1 Logistica reversa": o.reversa
          }));
          const ws = XLSX.utils.json_to_sheet(zmData);
          ws['!freeze'] = { xSplit: 0, ySplit: 1 };
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Pedidos ZM");
          const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          generatedFiles.push({
            blob: new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            filename: `ZM_Embalar_${timestamp}.xlsx`
          });
        }

        // 2. ENHOY XLSX Generation
        if (enhoyOrders.length > 0) {
          const enhoyData = enhoyOrders.map(o => ({
            "NOMBRE Y APELLIDO": o.pedidoNombre,
            "DIRECCION": o.direccion,
            "DEPARTAMENTO": o.observaciones,
            "EXTRA": o.referencia,
            "COMUNA": o.comuna,
            "CORREO": "",
            "TELEFONO": o.telefono,
            "Cambio": o.reversa,
            "Monto": moneyIntEnhoy(o.monto),
            "PROVEEDOR": userName.toUpperCase()
          }));
          const ws = XLSX.utils.json_to_sheet(enhoyData);
          ws['!freeze'] = { xSplit: 0, ySplit: 1 };
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Pedidos ENHOY");
          const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          generatedFiles.push({
            blob: new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            filename: `ENHOY_Embalar_${timestamp}.xlsx`
          });

          // PDF ETIQUETAS - FORMATO 100x150mm
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [100, 150]
          });

          const pageWidth = 100;
          const pageHeight = 150;
          const m = 3; // Margen de 3mm
          const contentWidth = pageWidth - (m * 2);

          enhoyOrders.forEach((order, i) => {
            if (i > 0) doc.addPage([100, 150], 'portrait');
            
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            const displayHeader = userName.toUpperCase();
            doc.text(displayHeader, pageWidth / 2, 10, { align: 'center' });

            doc.setFillColor(0, 0, 0);
            doc.rect(m, 14, contentWidth, 14, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text(order.comuna.toUpperCase(), pageWidth / 2, 23, { align: 'center' });

            doc.setTextColor(100, 100, 100);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Fecha: ${order.fecha}`, pageWidth - m, 34, { align: 'right' });

            doc.setDrawColor(220, 220, 220);
            doc.line(m, 37, pageWidth - m, 37);

            doc.setTextColor(120, 120, 120);
            doc.setFontSize(10);
            doc.text('Destinatario:', m, 45);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            const nameLines = doc.splitTextToSize(order.pedidoNombre, contentWidth);
            doc.text(nameLines, m, 52);

            let currentY = 52 + (nameLines.length * 6);

            doc.setFontSize(12);
            doc.text(`Tel: ${order.telefono}`, m, currentY);

            currentY += 8;

            doc.setTextColor(120, 120, 120);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Dirección:', m, currentY);
            
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            const addrLines = doc.splitTextToSize(order.direccion, contentWidth);
            doc.text(addrLines, m, currentY + 6);

            currentY = currentY + 6 + (addrLines.length * 5.5);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Notas:', m, currentY + 5);
            doc.setFont('helvetica', 'normal');
            const noteLines = doc.splitTextToSize(order.referencia || '-', contentWidth - 15);
            doc.text(noteLines, m + 14, currentY + 5);

            currentY += 5 + (noteLines.length * 5);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Obs:', m, currentY + 5);
            doc.setFont('helvetica', 'normal');
            const obsLines = doc.splitTextToSize(order.observaciones || '-', contentWidth - 12);
            doc.text(obsLines, m + 11, currentY + 5);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(26);
            doc.setFont('helvetica', 'bold');
            const priceText = `$${moneyIntEnhoy(order.monto).toLocaleString('es-CL')}`;
            doc.text(priceText, pageWidth - m, pageHeight - 12, { align: 'right' });

            doc.setDrawColor(240, 240, 240);
            doc.line(m, pageHeight - 8, pageWidth - m, pageHeight - 8);
            doc.setFontSize(8);
            doc.setTextColor(180, 180, 180);
            doc.text('TecnoDrop - Impresión Térmica', m, pageHeight - 4);
          });

          const pdfBlob = doc.output('blob');
          generatedFiles.push({
            blob: pdfBlob,
            filename: `ENHOY_Etiquetas_${timestamp}.pdf`
          });
        }

        resolve({
          files: generatedFiles,
          stats: {
            zmCount: zmOrders.length,
            enhoyCount: enhoyOrders.length,
            totalRows: data.length
          }
        });
      },
      error: (err: any) => reject(err)
    });
  });
};
