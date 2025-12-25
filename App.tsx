
import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Package,
  LogOut,
  User as UserIcon,
  Store,
  RefreshCw
} from 'lucide-react';
import { ProcessingState, ProcessingResult, User } from './types';
import { processCSV } from './services/processor';

const App: React.FC = () => {
  // --- AUTH STATE (Simplified) ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- APP STATE ---
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingState>(ProcessingState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessingResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('tecnodrop_session');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    setAuthLoading(false);
  }, []);

  const handleSelectUser = (name: string) => {
    const userSession: User = { 
      id: crypto.randomUUID(), 
      name: name, 
      username: name.toLowerCase().replace(/\s/g, '_') 
    };
    setCurrentUser(userSession);
    localStorage.setItem('tecnodrop_session', JSON.stringify(userSession));
    // Reset state when switching user to avoid confusion with previous files
    setFile(null);
    setResults(null);
    setStatus(ProcessingState.IDLE);
    setError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('tecnodrop_session');
    setCurrentUser(null);
    setFile(null);
    setResults(null);
    setStatus(ProcessingState.IDLE);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        setError('Por favor, selecciona un archivo .csv válido');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResults(null);
      setStatus(ProcessingState.IDLE);
    }
  };

  const handleProcess = async () => {
    if (!file || !currentUser) return;

    try {
      setStatus(ProcessingState.READING);
      setError(null);
      
      const { files, stats } = await processCSV(file, currentUser.name);
      
      setStatus(ProcessingState.COMPLETED);
      setResults(stats);

      files.forEach((genFile, index) => {
        setTimeout(() => {
          const url = window.URL.createObjectURL(genFile.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = genFile.filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }, 100);
        }, index * 250); 
      });
    } catch (err: any) {
      setStatus(ProcessingState.ERROR);
      setError(err.message || 'Error al procesar el archivo');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // --- SELECTION VIEW ---
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-lg text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="inline-flex bg-indigo-600 p-5 rounded-[2.5rem] shadow-2xl shadow-indigo-200 mb-8">
            <Package className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">TecnoDrop</h1>
          <p className="text-slate-500 mb-12 text-lg">Selecciona el perfil de facturación</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button 
              onClick={() => handleSelectUser('Ventas en Santiago')}
              className="group bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 hover:border-indigo-400 hover:shadow-indigo-100 transition-all text-center flex flex-col items-center gap-4 active:scale-95"
            >
              <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Store className="w-8 h-8" />
              </div>
              <div>
                <span className="block text-xl font-black text-slate-800">Ventas en Santiago</span>
                <span className="text-sm text-slate-400 font-medium">Formato Estándar</span>
              </div>
            </button>

            <button 
              onClick={() => handleSelectUser('Kikora')}
              className="group bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 hover:border-indigo-400 hover:shadow-indigo-100 transition-all text-center flex flex-col items-center gap-4 active:scale-95"
            >
              <div className="bg-purple-50 p-4 rounded-2xl text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <UserIcon className="w-8 h-8" />
              </div>
              <div>
                <span className="block text-xl font-black text-slate-800">Kikora</span>
                <span className="text-sm text-slate-400 font-medium">Formato Especial</span>
              </div>
            </button>
          </div>
          
          <p className="mt-16 text-slate-400 text-[10px] uppercase tracking-[0.3em] font-bold">
            Sistema de Despachos v3.1
          </p>
        </div>
      </div>
    );
  }

  // --- MAIN APP DASHBOARD ---
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row items-center justify-between mb-8 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-md">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none">TecnoDrop</h1>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Logística Chile</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <div className="hidden xs:block text-right">
              <p className="text-xs font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Usuario Actual</p>
              <p className="text-sm font-bold text-indigo-600 leading-none">{currentUser.name}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 pl-3 ml-3 border-l border-slate-200 text-slate-500 hover:text-red-600 transition-all group"
              title="Cambiar de perfil si te equivocaste"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-xs font-bold uppercase tracking-tight">Cambiar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
        <div className="p-8 md:p-12 text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Procesar Pedidos</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Las etiquetas se generarán con el remitente: <span className="text-indigo-600 font-black uppercase">{currentUser.name}</span>
          </p>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative group cursor-pointer border-2 border-dashed rounded-[2rem] p-12 md:p-16 transition-all duration-300
              ${file ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}
            `}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".csv" 
              className="hidden" 
            />
            <div className="flex flex-col items-center">
              <div className={`p-5 rounded-2xl mb-5 transition-all transform group-hover:scale-110 ${file ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-slate-100 text-slate-400'}`}>
                <Upload className="w-10 h-10" />
              </div>
              {file ? (
                <div className="animate-in slide-in-from-bottom-2">
                  <p className="text-xl font-bold text-slate-800 mb-1">{file.name}</p>
                  <p className="text-sm font-medium text-indigo-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <>
                  <p className="text-xl font-bold text-slate-700">Subir Archivo CSV</p>
                  <p className="text-sm text-slate-400 mt-2 font-medium">Haz clic o arrastra para cargar</p>
                </>
              )}
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center">
            <button
              onClick={handleProcess}
              disabled={!file || status === ProcessingState.PROCESSING || status === ProcessingState.READING}
              className={`
                flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-lg transition-all
                ${!file || status === ProcessingState.PROCESSING || status === ProcessingState.READING
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 hover:-translate-y-1 active:scale-95'}
              `}
            >
              {status === ProcessingState.READING || status === ProcessingState.PROCESSING ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  GENERANDO...
                </>
              ) : (
                <>
                  <FileText className="w-6 h-6" />
                  PROCESAR CSV
                </>
              )}
            </button>
          </div>
        </div>

        <div className="px-8 pb-10">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 p-5 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
              </div>
              <div>
                <p className="font-bold text-lg">Error de Archivo</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          )}

          {status === ProcessingState.COMPLETED && results && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-8 rounded-3xl animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500 text-white rounded-xl">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black">Procesamiento Exitoso</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">Etiquetas ZM</p>
                  <p className="text-3xl font-black">{results.zmCount}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">Etiquetas ENHOY</p>
                  <p className="text-3xl font-black">{results.enhoyCount}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">Total Pedidos</p>
                  <p className="text-3xl font-black">{results.zmCount + results.enhoyCount}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-emerald-100">
                 <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                   <Download className="w-5 h-5" />
                   Las descargas han comenzado
                 </div>
                 <button 
                  onClick={() => { setFile(null); setResults(null); setStatus(ProcessingState.IDLE); }}
                  className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                 >
                   NUEVA CARGA
                 </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 text-center pb-8">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
          &copy; 2024 TecnoDrop • Operador: {currentUser.name} • Perfil Activo
        </p>
      </footer>
    </div>
  );
};

export default App;
