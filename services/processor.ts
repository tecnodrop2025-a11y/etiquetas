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
          return reject(new Error("El archivo CSV esta vacio"));
        }

        // CSV de entrada: mismo formato de siempre (no cambia)
        const mappings = {
          B:  letterToIndex('B'),   // fecha
          C:  letterToIndex('C'),   // destinatario
          D:  letterToIndex('D'),   // direccion
          E:  letterToIndex('E'),   // comuna
          K:  letterToIndex('K'),   // monto
          L:  letterToIndex('L'),   // telefono
          O:  letterToIndex('O'),   // tracking
          Q:  letterToIndex('Q'),   // estado (filtro)
          AH: letterToIndex('AH'),  // observaciones
          BB: letterToIndex('BB'),  // reversa
          BC: letterToIndex('BC'),  // referencia
          BD: letterToIndex('BD'),  // pedidoNombre
        };

        const zmOrders: OrderRow[] = [];
        const enhoyOrders: OrderRow[] = [];

        data.forEach((row) => {
          const status = (row[mappings.Q] || '').trim().toUpperCase();
          if (status === 'EMBALAR-ZM' || status === 'EMBALAR-ENHOY') {
            const mapped: OrderRow = {
              fecha:         toDMY(row[mappings.B]),
              destinatario:  (row[mappings.C] || '').trim(),
              direccion:     (row[mappings.D] || '').trim(),
              comuna:        fixComuna(row[mappings.E]),
              monto:         row[mappings.K] || '',
              telefono:      (row[mappings.L] || '').trim(),
              tracking:      (row[mappings.O] || '').trim(),
              estado:        status,
              observaciones: (row[mappings.AH] || '').trim(),
              reversa:       (row[mappings.BB] || '').trim(),
              referencia:    (row[mappings.BC] || '').trim(),
              pedidoNombre:  (row[mappings.BD] || '').trim() || (row[mappings.C] || '').trim(),
            };
            if (status === 'EMBALAR-ZM') zmOrders.push(mapped);
            else enhoyOrders.push(mapped);
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

        // Funcion para construir fila en el NUEVO formato Excel del transportista
        // Nuevo formato (A-N):
        // A = tracking            (antigua A)
        // B = fecha               (antigua B)
        // C = valor_declarado     (antigua I = monto)
        // D = peso_kg             (vacio)
        // E = destinatario        (antigua C)
        // F = telefono            (antigua D)
        // G = direccion           (antigua E)
        // H = comuna              (antigua F)
        // I = observaciones       (antigua G)
        // J = email               (vacio)
        // K = referencia          (antigua H)
        // L = total_a_cobrar      (antigua I = monto)
        // M = logistica_reversa   (antigua J)
        // N = enviame_tracking    (vacio)
        const buildRow = (o: OrderRow) => ({
          "numero_venta_tracking": o.tracking,
          "fecha_venta":           o.fecha,
          "valor_declarado":       moneyIntEnhoy(o.monto),
          "peso_kg":               "",
          "destinatario":          o.destinatario,
          "telefono":              o.telefono,
          "direccion":             o.direccion,
          "comuna":                o.comuna,
          "observaciones":         o.observaciones,
          "email":                 "",
          "referencia":            o.referencia,
          "total_a_cobrar":        moneyIntEnhoy(o.monto),
          "logistica_reversa":     o.reversa,
          "enviame_tracking":      "",
        });

        // 1. ZM: genera CSV + copia XLSX (SAC_NOVACLIC)
        if (zmOrders.length > 0) {
          const zmData = zmOrders.map(buildRow);

          // 1a. ZM en formato CSV
          // Sanitizar: reemplazar saltos de línea dentro de los campos por un espacio
          const sanitize = (val: string) => String(val ?? '').replace(/\r\n|\r|\n/g, ' ');
          const zmDataClean = zmData.map(row =>
            Object.fromEntries(Object.entries(row).map(([k, v]) => [k, sanitize(v as string)]))
          );
          const wsCsv = XLSX.utils.json_to_sheet(zmDataClean);
          const csvContent = XLSX.utils.sheet_to_csv(wsCsv);
          generatedFiles.push({
            blob: new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
            filename: `NOVACLIC_Embalar_${timestamp}.csv`
          });


          // 1b. Copia en XLSX con nombre SAC_NOVACLIC
          const wsSac = XLSX.utils.json_to_sheet(zmData);
          wsSac['!freeze'] = { xSplit: 0, ySplit: 1 };
          const wbSac = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wbSac, wsSac, "Pedidos ZM");
          const wbSacOut = XLSX.write(wbSac, { bookType: 'xlsx', type: 'array' });
          generatedFiles.push({
            blob: new Blob([wbSacOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            filename: `SAC_NOVACLIC_${timestamp}.xlsx`
          });
        }


        // 2. ENHOY: solo PDF ETIQUETAS
        if (enhoyOrders.length > 0) {
          // PDF ETIQUETAS
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [100, 150]
          });

          const pageWidth = 100;
          const m = 5;
          const contentWidth = pageWidth - (m * 2);

          const QR_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkAQMAAABKLAcXAAAABlBMVEX///8AAABVwtN+AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAwklEQVQ4jaXUsQ2EMAwFUEcUKdkANoG1UiBdpBSsBZuEDSgpUP7ZQeiguzhuotd8YTuB6FUfAN7gGPmMBXJENmB3A1FToRFWMoceoU4hkdPId9WSjmLrH/0pJNMN2+5+s/5PubrXShXiTIvYzms8pgqt/HUbkOigIqXenoY7yu2oJdPo2jtTKTKR57o7E+1ZJK5my/J65d0C89Lj1EtulkQbyFEgeR1XSq3SPc8q4d5tgeRVXSmTXnme/J94bEWhV30BooNO2JwYHyYAAAAASUVORK5CYII=';

          const drawPersonIcon = (d: jsPDF, x: number, y: number) => {
            d.circle(x, y - 1, 1.2, 'S');
            d.path([{op:'m',c:[x-1.8,y+2.5]},{op:'l',c:[x-1.8,y+1.5]},{op:'c',c:[x-1.8,y+0.5,x+1.8,y+0.5,x+1.8,y+1.5]},{op:'l',c:[x+1.8,y+2.5]}]);
          };
          const drawPhoneIcon = (d: jsPDF, x: number, y: number) => {
            d.path([{op:'m',c:[x-1,y-1.5]},{op:'l',c:[x+1,y-1.5]},{op:'l',c:[x+1.5,y+1.5]},{op:'l',c:[x-1.5,y+1.5]},{op:'h'}]);
            d.circle(x, y+1.5, 0.8, 'S');
          };
          const drawLocationIcon = (d: jsPDF, x: number, y: number) => {
            d.circle(x, y-1, 1.5, 'S');
            d.line(x, y+0.5, x, y+2.5);
          };

          enhoyOrders.forEach((order, i) => {
            if (i > 0) doc.addPage([100, 150], 'portrait');

            // QR (izquierda)
            doc.addImage(QR_BASE64, 'PNG', 5, 5, 38, 38);

            // COMUNA (derecha, rectangulo negro)
            doc.setFillColor(0, 0, 0);
            doc.roundedRect(48, 5, 47, 9, 1.5, 1.5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(order.comuna.toUpperCase(), 71.5, 11, { align: 'center' });

            // FECHA
            doc.setTextColor(0, 0, 0);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.rect(48, 17, 4, 4);
            doc.line(48, 18.5, 52, 18.5);
            doc.line(49, 16, 49, 17.5);
            doc.line(51, 16, 51, 17.5);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(selectedDateDisplay, 54, 20.5);

            // RTE / VENTA / ENVIO
            doc.setFont('helvetica', 'normal');
            doc.text('Rte.: ', 48, 29);
            doc.setFont('helvetica', 'bold');
            doc.text(userName.toUpperCase(), 57, 29);

            doc.setFont('helvetica', 'normal');
            doc.text('Venta: ', 48, 36);
            doc.setFont('helvetica', 'bold');
            doc.text(order.tracking, 60, 36);

            doc.setFont('helvetica', 'normal');
            doc.text('Envio: ', 48, 43);
            doc.setFont('helvetica', 'bold');
            doc.text(order.tracking, 60, 43);

            // DESTINATARIO
            let currentY = 52;
            doc.setFillColor(150, 150, 150);
            doc.circle(7, currentY - 1.2, 1.2, 'F');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text('Destinatario', 10, currentY);

            currentY += 8;
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            const cleanName = order.destinatario.replace(/^#\d+\s*-\s*/, '').replace(/\s*-\s*$/, '');
            drawPersonIcon(doc, 7, currentY - 1);
            doc.text(cleanName, 12, currentY);
            drawPhoneIcon(doc, 55, currentY - 1);
            doc.text(order.telefono, 60, currentY);

            currentY += 10;
            drawLocationIcon(doc, 7, currentY - 1);
            doc.setFont('helvetica', 'bold');
            const addrLines = doc.splitTextToSize(order.direccion, contentWidth - 8);
            doc.text(addrLines, 12, currentY);

            currentY += (addrLines.length * 5) + 6;
            doc.setFont('helvetica', 'bold');
            doc.text('Observacion: ', 5, currentY);
            doc.setFont('helvetica', 'normal');
            const obsLines = doc.splitTextToSize(order.observaciones || '-', contentWidth - 30);
            doc.text(obsLines, 32, currentY);

            // CAMPOS EXTRA
            currentY += (obsLines.length * 5) + 8;
            doc.setFillColor(150, 150, 150);
            doc.circle(7, currentY - 1.2, 1.2, 'F');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text('Campos extra', 10, currentY);

            currentY += 8;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Total a pagar: ', 5, currentY);
            doc.text(`$${moneyIntEnhoy(order.monto).toLocaleString('es-CL')}`, 32, currentY);
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
