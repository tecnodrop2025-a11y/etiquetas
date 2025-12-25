import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Package,
  Store,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { ProcessingState, ProcessingResult, User } from './types';
import { processCSV } from './services/processor';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingState>(ProcessingState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessingResult | null>(null);
  
  // Estados para la fecha de las etiquetas
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('tecnodrop_session');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    setAuthLoading(false);
  }, []);

  const handleSelectUser = (name: string) => {
    const userSession: User = { id: crypto.randomUUID(), name, username: name.toLowerCase().replace(/\s/g, '_') };
    setCurrentUser(userSession);
    localStorage.setItem('tecnodrop_session', JSON.stringify(userSession));
    setFile(null); setResults(null); setStatus(ProcessingState.IDLE); setError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('tecnodrop_session');
    setCurrentUser(null); setFile(null); setResults(null); setStatus(ProcessingState.IDLE); setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        setError('Por favor, selecciona un archivo .csv válido');
        setFile(null); return;
      }
      setFile(selectedFile); setError(null); setResults(null); setStatus(ProcessingState.IDLE);
    }
  };

  const handleProcess = async () => {
    if (!file || !currentUser) return;
    try {
      setStatus(ProcessingState.READING);
      setError(null);
      
      // Pasar la fecha si se eligió personalizada
      const dateToUse = useCustomDate ? selectedDate : undefined;
      
      const { files, stats } = await processCSV(file, currentUser.name, dateToUse);
      setStatus(ProcessingState.COMPLETED);
      setResults(stats);
      
      files.forEach((genFile, index) => {
        setTimeout(() => {
          const url = window.URL.createObjectURL(genFile.blob);
          const a = document.createElement('a');
          a.href = url; a.download = genFile.filename;
          document.body.appendChild(a); a.click();
          setTimeout(() => { window.URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
        }, index * 300); 
      });
    } catch (err: any) {
      setStatus(ProcessingState.ERROR);
      setError(err.message || 'Error al procesar el archivo');
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-xl text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="inline-flex bg-indigo-600 p-6 rounded-[2.5rem] shadow-2xl shadow-indigo-200 mb-10">
            <Package className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-3">TecnoDrop</h1>
          <p className="text-slate-500 mb-14 text-lg">Selecciona tu perfil de acceso</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {['Ventas en Santiago', 'Kikora'].map((name) => (
              <button 
                key={name}
                onClick={() => handleSelectUser(name)}
                className="group bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 hover:border-indigo-400 hover:shadow-indigo-100 transition-all flex flex-col items-center gap-6 active:scale-95"
              >
                <div className="bg-indigo-50 p-6 rounded-3xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  <Store className="w-12 h-12" />
                </div>
                <span className="block text-2xl font-black text-slate-800">{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row items-center justify-between mb-8 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-md"><Package className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-black text-slate-900 leading-none">TecnoDrop</h1><span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Logística Chile</span></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <p className="text-sm font-bold text-indigo-600">{currentUser.name}</p>
            <button onClick={handleLogout} className="flex items-center gap-2 pl-3 ml-3 border-l border-slate-200 text-slate-500 hover:text-red-600 transition-all group">
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-xs font-bold uppercase">Cambiar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
        <div className="p-8 md:p-12 text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-8">Procesar Archivo CSV</h2>
          
          <div onClick={() => fileInputRef.current?.click()} className={`relative group cursor-pointer border-2 border-dashed rounded-[2rem] p-12 transition-all mb-8 ${file ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
            <div className="flex flex-col items-center">
              <div className={`p-5 rounded-2xl mb-5 transition-all ${file ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-slate-100 text-slate-400'}`}><Upload className="w-10 h-10" /></div>
              {file ? <p className="text-xl font-bold text-slate-800">{file.name}</p> : <p className="text-xl font-bold text-slate-700">Subir CSV</p>}
            </div>
          </div>

          {/* Selector de Fecha */}
          {file && status !== ProcessingState.READING && (
            <div className="bg-indigo-50/30 p-8 rounded-[2rem] border border-indigo-100 text-left mb-8 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-black text-slate-800 tracking-tight text-lg">Fecha de las etiquetas</h3>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setUseCustomDate(false)}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm border-2 transition-all ${!useCustomDate ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                >
                  HOY ({new Date().toLocaleDateString()})
                </button>
                <button 
                  onClick={() => setUseCustomDate(true)}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm border-2 transition-all ${useCustomDate ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                >
                  ELEGIR FECHA
                </button>
              </div>

              {useCustomDate && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-indigo-500 group-focus-within:text-indigo-600" />
                    </div>
                    <input 
                      type="date" 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-white focus:border-indigo-500 outline-none font-black text-slate-700 bg-white shadow-xl shadow-slate-100/50 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-center">
            <button 
              onClick={handleProcess} 
              disabled={!file || status === ProcessingState.READING} 
              className={`flex items-center gap-3 px-12 py-4 rounded-2xl font-black text-lg transition-all ${!file || status === ProcessingState.READING ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 active:scale-95'}`}
            >
              {status === ProcessingState.READING ? <><Loader2 className="w-6 h-6 animate-spin" /> GENERANDO...</> : <><FileText className="w-6 h-6" /> PROCESAR</>}
            </button>
          </div>
        </div>

        <div className="px-8 pb-10">
          {error && <div className="bg-red-50 text-red-700 p-5 rounded-2xl flex items-center gap-4"><AlertCircle className="w-6 h-6" /> <p className="font-bold">{error}</p></div>}
          {status === ProcessingState.COMPLETED && results && (
            <div className="bg-emerald-50 text-emerald-800 p-8 rounded-3xl animate-in zoom-in-95">
              <div className="flex items-center gap-3 mb-6"><CheckCircle className="w-6 h-6 text-emerald-500" /><h3 className="text-2xl font-black">¡Completado!</h3></div>
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-5 rounded-2xl">
                  <p className="text-xs font-bold uppercase text-slate-400">ZM</p><p className="text-3xl font-black">{results.zmCount}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl">
                  <p className="text-xs font-bold uppercase text-slate-400">ENHOY</p><p className="text-3xl font-black">{results.enhoyCount}</p>
                </div>
              </div>
              <button onClick={() => { setFile(null); setResults(null); setStatus(ProcessingState.IDLE); }} className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl">NUEVA CARGA</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;