
export interface User {
  id: string;
  name: string;
  username: string;
}

export interface OrderRow {
  fecha: string;        // B
  destinatario: string; // C
  direccion: string;    // D
  comuna: string;       // E
  monto: string;        // K
  telefono: string;     // L
  tracking: string;     // O
  estado: string;       // Q
  observaciones: string;// AH
  reversa: string;      // BB
  referencia: string;   // BC
  pedidoNombre: string; // BD
}

export enum ProcessingState {
  IDLE = 'IDLE',
  READING = 'READING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ProcessingResult {
  zmCount: number;
  enhoyCount: number;
  totalRows: number;
}
