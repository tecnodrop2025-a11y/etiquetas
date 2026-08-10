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

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
};

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
        let logoImg: HTMLImageElement | null = null;
        try {
          logoImg = await loadImage('/logo.png');
        } catch (e) {
          console.warn('No se pudo cargar logo.png', e);
        }

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

          // Base64 estático para el QR que contiene "1"
          const QR_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkAQMAAABKLAcXAAAABlBMVEX///8AAABVwtN+AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAwklEQVQ4jaXUsQ2EMAwFUEcUKdkANoG1UiBdpBSsBZuEDSgpUP7ZQeiguzhuotd8YTuB6FUfAN7gGPmMBXJENmB3A1FToRFWMoceoU4hkdPId9WSjmLrH/0pJNMN2+5+s/5PubrXShXiTIvYzms8pgqt/HUbkOigIqXenoY7yu2oJdPo2jtTKTKR57o7E+1ZJK5my/J65d0C89Lj1EtulkQbyFEgeR1XSq3SPc8q4d5tgeRVXSmTXnme/J94bEWhV30BooNO2JwYHyYAAAAASUVORK5CYII=';

          // Función auxiliar para dibujar ícono de persona
          const drawPersonIcon = (d: jsPDF, x: number, y: number) => {
            d.circle(x, y - 1, 1.2, 'S');
            d.path([{op: 'm', c: [x - 1.8, y + 2.5]}, {op: 'l', c: [x - 1.8, y + 1.5]}, {op: 'c', c: [x - 1.8, y + 0.5, x + 1.8, y + 0.5, x + 1.8, y + 1.5]}, {op: 'l', c: [x + 1.8, y + 2.5]}]);
          };

          // Función auxiliar para dibujar ícono de teléfono
          const drawPhoneIcon = (d: jsPDF, x: number, y: number) => {
            d.path([{op: 'm', c: [x - 1, y - 1.5]}, {op: 'l', c: [x + 1, y - 1.5]}, {op: 'l', c: [x + 1.5, y + 1.5]}, {op: 'l', c: [x - 1.5, y + 1.5]}, {op: 'h'}]);
            d.circle(x, y + 1.5, 0.8, 'S');
          };

          // Función auxiliar para dibujar ícono de pin (ubicación)
          const drawLocationIcon = (d: jsPDF, x: number, y: number) => {
            d.circle(x, y - 1, 1.5, 'S');
            d.line(x, y + 0.5, x, y + 2.5);
          };


          enhoyOrders.forEach((order, i) => {
            if (i > 0) doc.addPage([100, 150], 'portrait');
            
            // LOGO & TÍTULO (Transalianza Spa)
            if (logoImg) {
              doc.addImage(logoImg, 'PNG', 5, 5, 15, 15);
            }
            
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text("Transalianza Spa.", 22, 15);

            // CÓDIGO QR
            doc.addImage(QR_BASE64, 'PNG', 5, 22, 38, 38);

            // COMUNA (Rectángulo negro, borde redondeado)
            doc.setFillColor(0, 0, 0);
            doc.roundedRect(48, 22, 47, 8, 1.5, 1.5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text(order.comuna.toUpperCase(), 71.5, 27.5, { align: 'center' });

            // FECHA (Con ícono de calendario)
            doc.setTextColor(0, 0, 0);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            // Dibujar calendario
            doc.rect(48, 33, 4, 4);
            doc.line(48, 34.5, 52, 34.5);
            doc.line(49, 32, 49, 33.5);
            doc.line(51, 32, 51, 33.5);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(selectedDateDisplay, 54, 36.5);

            // RTE, VENTA, ENVIO
            doc.setFont('helvetica', 'normal');
            doc.text('Rte.: ', 48, 45);
            doc.setFont('helvetica', 'bold');
            doc.text(userName.toUpperCase(), 57, 45);

            const orderId = extractOrderId(order.pedidoNombre) || extractOrderId(order.destinatario) || "S/N";
            
            doc.setFont('helvetica', 'normal');
            doc.text('Venta: ', 48, 52);
            doc.setFont('helvetica', 'bold');
            doc.text(`#${orderId}`, 60, 52);

            doc.setFont('helvetica', 'normal');
            doc.text('Envio: ', 48, 59);
            doc.setFont('helvetica', 'bold');
            doc.text(`#${orderId}`, 60, 59);

            // SECCIÓN DESTINATARIO
            let currentY = 68;
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
            
            // Extraer nombre (eliminar el ID y guiones si existen al principio)
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
            doc.text('Observación: ', 5, currentY);
            doc.setFont('helvetica', 'normal');
            const obsLines = doc.splitTextToSize(order.observaciones || '-', contentWidth - 30);
            doc.text(obsLines, 32, currentY);

            // SECCIÓN CAMPOS EXTRA
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