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

export const processCSV = async (
  file: File, 
  userName: string, 
  customDate?: string
): Promise<{ files: GeneratedFile[]; stats: any }> => {
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
            else if (status === 'EMBALAR-ENHOY') enhoyOrders.push(mapped);
          }
        });

        if (zmOrders.length === 0 && enhoyOrders.length === 0) {
          return reject(new Error("No se encontraron pedidos con estado EMBALAR-ZM o EMBALAR-ENHOY"));
        }

        const extractOrderId = (name: string): number => {
          const match = name.match(/#?(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        };

        enhoyOrders.sort((a, b) => extractOrderId(a.pedidoNombre) - extractOrderId(b.pedidoNombre));

        const generatedFiles: GeneratedFile[] = [];
        const timestamp = getTimestamp();
        
        let selectedDateDisplay = "";
        if (customDate) {
          const [y, m, d] = customDate.split('-');
          selectedDateDisplay = `${d}/${m}/${y}`;
        } else {
          const today = new Date();
          selectedDateDisplay = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        }

        // 1. ZM XLSX Generation
        if (zmOrders.length > 0) {
          const zmData = zmOrders.map(o => ({
            "Numero de tracking": o.tracking,
            "Fecha de venta": selectedDateDisplay,
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

        // 2. ENHOY XLSX Generation (Con pestañas Instrucciones y Planilla Carga)
        if (enhoyOrders.length > 0) {
          const enhoyData = enhoyOrders.map(o => ({
            "NOMBRE Y APELLIDO": o.pedidoNombre,
            "DIRECCION": o.direccion,
            "CASA/DEPTO./OFICINA": o.observaciones,
            "INDICACIONES GENERALES": o.referencia,
            "COMUNA": o.comuna,
            "CORREO": "",
            "TELEFONO": o.telefono,
            "CAMBIO": o.reversa,
            "MONTO": moneyIntEnhoy(o.monto)
          }));

          const wb = XLSX.utils.book_new();
          
          // Hoja 1: Instrucciones
          const wsInstr = XLSX.utils.aoa_to_sheet([
            ["INSTRUCCIONES DE CARGA"],
            [""],
            ["1. Esta planilla contiene los pedidos marcados como EMBALAR-ENHOY."],
            ["2. La hoja 'Planilla Carga' contiene la información necesaria para el transporte."],
            ["3. No modifique los encabezados de la columna."],
            [""],
            ["Fecha de proceso:", selectedDateDisplay]
          ]);
          XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones");

          // Hoja 2: Planilla Carga
          const wsData = XLSX.utils.json_to_sheet(enhoyData);
          wsData['!freeze'] = { xSplit: 0, ySplit: 1 };
          XLSX.utils.book_append_sheet(wb, wsData, "Planilla Carga");

          const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          generatedFiles.push({
            blob: new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            filename: `ENHOY_Embalar_${timestamp}.xlsx`
          });

          // PDF ETIQUETAS
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [100, 150]
          });

          const pageWidth = 100;
          const pageHeight = 150;
          const m = 5;
          const contentWidth = pageWidth - (m * 2);

          enhoyOrders.forEach((order, i) => {
            if (i > 0) doc.addPage([100, 150], 'portrait');
            
            // NOMBRE TIENDA - Negro Puro y Negrita
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(userName.toUpperCase(), pageWidth / 2, 10, { align: 'center' });

            // COMUNA
            doc.setFillColor(0, 0, 0);
            doc.rect(m, 14, contentWidth, 16, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.text(order.comuna.toUpperCase(), pageWidth / 2, 25, { align: 'center' });

            // FECHA - Negro y Negrita
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`Fecha: ${selectedDateDisplay}`, pageWidth - m, 36, { align: 'right' });

            // DESTINATARIO
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('DESTINATARIO:', m, 45);
            doc.setFontSize(14);
            const nameLines = doc.splitTextToSize(order.pedidoNombre, contentWidth);
            doc.text(nameLines, m, 52);

            let currentY = 52 + (nameLines.length * 6);
            doc.setFontSize(12);
            doc.text(`Tel: ${order.telefono}`, m, currentY);

            currentY += 10;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('DIRECCIÓN:', m, currentY);
            doc.setFontSize(13);
            const addrLines = doc.splitTextToSize(order.direccion, contentWidth);
            doc.text(addrLines, m, currentY + 6);

            currentY += 6 + (addrLines.length * 6);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('REF:', m, currentY);
            doc.setFont('helvetica', 'normal');
            const refLines = doc.splitTextToSize(order.referencia || '-', contentWidth - 12);
            doc.text(refLines, m + 12, currentY);

            currentY += Math.max(6, (refLines.length * 5)) + 4; 
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('OBS:', m, currentY);
            doc.setFont('helvetica', 'normal');
            const obsLines = doc.splitTextToSize(order.observaciones || '-', contentWidth - 12);
            doc.text(obsLines, m + 12, currentY);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(28);
            doc.text(`Total: $${moneyIntEnhoy(order.monto).toLocaleString('es-CL')}`, pageWidth - m, pageHeight - 10, { align: 'right' });
            
            doc.setDrawColor(200, 200, 200);
            doc.line(m, pageHeight - 20, pageWidth - m, pageHeight - 20);
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
      error: (err: Error) => reject(err)
    });
  });
};