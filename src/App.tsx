import React, { useState, useEffect, useRef } from "react";
import { 
  Map as MapIcon, 
  Timer, 
  User, 
  ChevronRight, 
  CheckCircle2, 
  Download, 
  RefreshCcw,
  ArrowRight,
  Trophy,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import QuickPinchZoom, { make3dTransformValue } from "react-quick-pinch-zoom";
import { jsPDF } from "jspdf";
import confetti from "canvas-confetti";

// --- Types ---

type Screen = "HOME" | "ROUTE_SELECTION" | "RACE" | "BORG_SCALE" | "RESULTS";

interface UserData {
  nombre: string;
  apellidos: string;
  edad: string;
  curso: string;
  grupo: string;
}

interface Route {
  id: number;
  name: string;
  balizas: number;
  mapUrl: string;
  codes: string[];
}

interface RaceResult {
  routeId: number;
  routeName: string;
  timeTaken: number; // in seconds
  hits: number;
  totalBalizas: number;
  borgScale: number;
  timestamp: string;
  balizaTimes: number[]; // Timestamps for each beacon found
}

// --- Constants ---

const ROUTES: Route[] = [
  { 
    id: 1, 
    name: "Recorrido 1", 
    balizas: 7, 
    mapUrl: "https://raw.githubusercontent.com/josecarlostejedor/ISLA-SOTO-ORIENTACION/main/Recorrido%201IS.jpg",
    codes: ["1359-016", "1359-010", "1359-003", "1359-045", "PARQUE LA ALDEHUELA", "1359-052", "1359-029"]
  },
  { 
    id: 2, 
    name: "Recorrido 2", 
    balizas: 7, 
    mapUrl: "https://raw.githubusercontent.com/josecarlostejedor/ISLA-SOTO-ORIENTACION/main/Recorrido%202IS.jpg",
    codes: ["1359-040", "PARQUE LA ALDEHUELA", "1359-045", "1359-003", "1359-010", "1359-016", "1359-029"]
  },
  { 
    id: 3, 
    name: "Recorrido 3", 
    balizas: 7, 
    mapUrl: "https://raw.githubusercontent.com/josecarlostejedor/ISLA-SOTO-ORIENTACION/main/Recorrido%203IS.jpg",
    codes: ["1359-003", "1359-045", "PARQUE LA ALDEHUELA", "1359-052", "1359-029", "1359-016", "1359-010"]
  },
  { 
    id: 4, 
    name: "Recorrido 4", 
    balizas: 7, 
    mapUrl: "https://raw.githubusercontent.com/josecarlostejedor/ISLA-SOTO-ORIENTACION/main/Recorrido%204IS.jpg",
    codes: ["ESPADAÑA", "FRESNO", "SAUCE", "OLMO", "CHOPO", "ALISO", "NOGAL"]
  },
  { 
    id: 5, 
    name: "Recorrido 5", 
    balizas: 7, 
    mapUrl: "https://raw.githubusercontent.com/josecarlostejedor/ISLA-SOTO-ORIENTACION/main/Recorrido%205IS.jpg",
    codes: ["NOGAL", "ORTIGA", "CHOPO", "CARRIZO", "SAUCE", "FRESNO", "ESPADAÑA"]
  },
  { 
    id: 6, 
    name: "Recorrido 6", 
    balizas: 7, 
    mapUrl: "https://raw.githubusercontent.com/josecarlostejedor/ISLA-SOTO-ORIENTACION/main/Recorrido%206IS.jpg",
    codes: ["FRESNO", "SAUCE", "OLMO", "CHOPO", "ORTIGA", "ALISO", "NOGAL"]
  },
];

const normalizeString = (str: string) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\s+/g, "") // Remove all spaces
    .toLowerCase();
};

const CURSOS = [
  "1º ESO", 
  "2º ESO", 
  "3º ESO", 
  "1º BACHILLERATO", 
  "2º BACHILLERATO", 
  "FP BÁSICA", 
  "Otro nivel educativo"
];

const GRUPOS = ["1", "2", "3", "4", "5", "6", "7", "8"];

// --- Components ---

const Header = () => (
  <div className="bg-white border-b border-gray-100 py-4 px-6 text-center shadow-sm">
    <div className="flex items-center justify-center gap-2 mb-1">
      <MapIcon className="w-5 h-5 text-red-800" />
      <h1 className="text-xl font-bold tracking-tight text-gray-900 uppercase">ISLA DEL SOTO</h1>
    </div>
    <p className="text-xs font-medium text-gray-500 tracking-widest uppercase">IES LUCÍA DE MEDRANO</p>
  </div>
);

const Footer = () => (
  <div className="mt-12 text-center pb-8 px-6">
    <div className="h-px bg-gray-200 w-full mb-6" />
    <div className="flex justify-center gap-8 mb-4 opacity-40">
      <Activity className="w-5 h-5" />
      <MapIcon className="w-5 h-5" />
      <Timer className="w-5 h-5" />
    </div>
    <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-1">PROYECTO DE ORIENTACIÓN ESCOLAR</p>
    <p className="text-[10px] text-gray-400 uppercase">App creada por Jose Carlos Tejedor Lorenzo</p>
  </div>
);

export default function App() {
  const [screen, setScreen] = useState<Screen>("HOME");
  const [userData, setUserData] = useState<UserData>({
    nombre: "",
    apellidos: "",
    edad: "",
    curso: "",
    grupo: "",
  });
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [currentBaliza, setCurrentBaliza] = useState(1);
  const [balizaCodes, setBalizaCodes] = useState<string[]>([]);
  const [balizaTimes, setBalizaTimes] = useState<number[]>([]);
  const [currentCode, setCurrentCode] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [borgScale, setBorgScale] = useState(5);
  const [results, setResults] = useState<RaceResult | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<"IDLE" | "SUBMITTING" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Timer logic
  const [elapsedTime, setElapsedTime] = useState(0);

  // Persistence logic - Load state
  useEffect(() => {
    const savedState = localStorage.getItem("orienteering_app_state");
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.userData) setUserData(state.userData);
        if (state.screen) setScreen(state.screen);
        if (state.selectedRouteId) {
          const route = ROUTES.find(r => r.id === state.selectedRouteId);
          if (route) setSelectedRoute(route);
        }
        if (state.startTime) setStartTime(state.startTime);
        if (state.currentBaliza) setCurrentBaliza(state.currentBaliza);
        if (state.balizaCodes) setBalizaCodes(state.balizaCodes);
        if (state.balizaTimes) setBalizaTimes(state.balizaTimes);
        if (state.endTime) setEndTime(state.endTime);
        if (state.results) setResults(state.results);
      } catch (e) {
        console.error("Error loading state", e);
      }
    }
  }, []);

  // Persistence logic - Save state
  useEffect(() => {
    const state = {
      userData,
      screen,
      selectedRouteId: selectedRoute?.id,
      startTime,
      currentBaliza,
      balizaCodes,
      balizaTimes,
      endTime,
      results
    };
    localStorage.setItem("orienteering_app_state", JSON.stringify(state));
  }, [userData, screen, selectedRoute, startTime, currentBaliza, balizaCodes, endTime, results]);

  useEffect(() => {
    let interval: number;
    
    if (screen === "RACE" && startTime && !endTime) {
      // Use a more robust timer approach for mobile browsers
      // Calculating based on absolute time difference is best
      const updateTimer = () => {
        const now = Date.now();
        const diff = Math.floor((now - startTime) / 1000);
        setElapsedTime(diff);
      };

      updateTimer(); // Initial call
      interval = window.setInterval(updateTimer, 1000);
    }
    
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [screen, startTime, endTime]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRace = () => {
    const now = Date.now();
    setStartTime(now);
    setEndTime(null);
    setElapsedTime(0);
    setCurrentBaliza(1);
    setBalizaCodes([]);
    setBalizaTimes([]);
    setCurrentCode("");
    setScreen("RACE");
    
    // Update persistence immediately
    const savedState = localStorage.getItem("orienteering_app_state");
    const state = savedState ? JSON.parse(savedState) : {};
    localStorage.setItem("orienteering_app_state", JSON.stringify({
      ...state,
      startTime: now,
      endTime: null,
      screen: "RACE",
      currentBaliza: 1,
      balizaCodes: [],
      balizaTimes: [],
      results: null
    }));
  };

  const handleResetApp = () => {
    localStorage.removeItem("orienteering_app_state");
    setUserData({ nombre: "", apellidos: "", edad: "", curso: "", grupo: "" });
    setSelectedRoute(null);
    setScreen("HOME");
    setStartTime(null);
    setEndTime(null);
    setResults(null);
    setBalizaCodes([]);
    setBalizaTimes([]);
    setCurrentBaliza(1);
    setElapsedTime(0);
  };

  const handleNextBaliza = () => {
    const now = Date.now();
    const newCodes = [...balizaCodes, currentCode];
    const newTimes = [...balizaTimes, now];
    setBalizaCodes(newCodes);
    setBalizaTimes(newTimes);
    setCurrentCode("");
    
    if (currentBaliza < (selectedRoute?.balizas || 7)) {
      setCurrentBaliza(currentBaliza + 1);
    } else {
      setEndTime(now);
      setScreen("BORG_SCALE");
    }
  };

  useEffect(() => {
    if (results && submissionStatus === "IDLE") {
      submitToGoogleSheets(results);
    }
  }, [results]);

  const submitToGoogleSheets = async (raceResult: RaceResult) => {
    setSubmissionStatus("SUBMITTING");
    try {
      // Calculate split times relative to start
      const splits = raceResult.balizaTimes.map(time => {
        const diff = Math.floor((time - startTime!) / 1000);
        return formatTime(diff);
      });

      const response = await fetch("/api/submit-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userData,
          ...raceResult,
          // Add formatted fields for Google Sheets
          tiempoFormateado: formatTime(raceResult.timeTaken),
          aciertosFormateado: `${raceResult.hits} / ${raceResult.totalBalizas}`,
          // Also override original fields if the script expects them as strings
          timeTaken: formatTime(raceResult.timeTaken),
          hits: `${raceResult.hits} / ${raceResult.totalBalizas}`,
          // Multiple variations of the score field to ensure it's picked up by the script
          puntuacion: ((raceResult.hits / raceResult.totalBalizas) * 10).toFixed(1),
          score: ((raceResult.hits / raceResult.totalBalizas) * 10).toFixed(1),
          puntuacion_total: ((raceResult.hits / raceResult.totalBalizas) * 10).toFixed(1),
          Puntuacion: ((raceResult.hits / raceResult.totalBalizas) * 10).toFixed(1),
          
          // NEW: Split times
          tiemposParciales: splits.join(", "),
          ...splits.reduce((acc, time, idx) => {
            acc[`baliza${idx + 1}`] = time;
            return acc;
          }, {} as Record<string, string>)
        }),
      });
      const data = await response.json();
      console.log("Submission result:", data);
      if (data.success) {
        setSubmissionStatus("SUCCESS");
      } else {
        setSubmissionStatus("ERROR");
        setErrorMessage(data.error || "Error desconocido");
      }
    } catch (err) {
      console.error("Failed to submit results", err);
      setSubmissionStatus("ERROR");
      setErrorMessage("Error de conexión con el servidor");
    }
  };

  const calculateResults = async () => {
    if (!selectedRoute || !startTime || !endTime) return;
    
    // Validate codes using normalization
    let hits = 0;
    balizaCodes.forEach((userCode, index) => {
      const correctCode = selectedRoute.codes[index];
      if (normalizeString(userCode) === normalizeString(correctCode)) {
        hits++;
      }
    });
    
    const raceResult: RaceResult = {
      routeId: selectedRoute.id,
      routeName: selectedRoute.name,
      timeTaken: Math.floor((endTime - startTime) / 1000),
      hits,
      totalBalizas: selectedRoute.balizas,
      borgScale,
      timestamp: new Date().toLocaleString(),
      balizaTimes,
    };

    setResults(raceResult);
    setScreen("RESULTS");
    confetti();
  };

  const generatePDF = async () => {
    if (!results || !selectedRoute) return;
    setIsGeneratingPDF(true);
    try {
      const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // --- Header ---
    // Background for header
    doc.setFillColor(153, 27, 27); // Red-800
    doc.rect(0, 0, pageWidth, 45, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("REPORTE DE ORIENTACIÓN", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("IES LUCÍA DE MEDRANO - ISLA DEL SOTO", pageWidth / 2, 30, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("(App creada por Jose Carlos Tejedor)", pageWidth / 2, 38, { align: "center" });
    
    // --- Content ---
    let yPos = 60;
    doc.setTextColor(31, 41, 55); // Gray-900
    
    // Section: Datos del Corredor
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("DATOS DEL CORREDOR", margin, yPos);
    yPos += 2;
    doc.setDrawColor(153, 27, 27);
    doc.setLineWidth(1);
    doc.line(margin, yPos, margin + 50, yPos);
    yPos += 10;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    
    const drawDataRow = (label: string, value: string, y: number) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, margin + 40, y);
    };
    
    drawDataRow("Nombre", `${userData.nombre} ${userData.apellidos}`, yPos); yPos += 8;
    drawDataRow("Edad", userData.edad, yPos); yPos += 8;
    drawDataRow("Curso", userData.curso, yPos); yPos += 8;
    drawDataRow("Grupo", userData.grupo, yPos); yPos += 15;
    
    // Section: Resultados de la Carrera
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("RESULTADOS DE LA CARRERA", margin, yPos);
    yPos += 2;
    doc.line(margin, yPos, margin + 70, yPos);
    yPos += 10;
    
    const score = ((results.hits / results.totalBalizas) * 10).toFixed(1);
    
    drawDataRow("Recorrido", results.routeName, yPos); yPos += 8;
    drawDataRow("Tiempo", formatTime(results.timeTaken), yPos); yPos += 8;
    drawDataRow("Aciertos", `${results.hits} / ${results.totalBalizas}`, yPos); yPos += 8;
    drawDataRow("Puntuación", `${score} / 10`, yPos); yPos += 8;
    drawDataRow("Escala Borg", `${results.borgScale} / 10`, yPos); yPos += 8;
    drawDataRow("Fecha", results.timestamp, yPos); yPos += 20;
    
    // Section: Desglose de las Balizas
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("DESGLOSE DE LAS BALIZAS", margin, yPos);
    yPos += 2;
    doc.setDrawColor(16, 185, 129); // Emerald-500
    doc.line(margin, yPos, margin + 70, yPos);
    yPos += 10;

    // Table Header
    const col1Width = 45;
    const col2Width = 45;
    const col3Width = 35;
    const col4Width = 45;
    
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.rect(margin, yPos, contentWidth, 10, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("Descripción", margin + 5, yPos + 7);
    doc.text("Código", margin + col1Width + 5, yPos + 7);
    doc.text("Resultado", margin + col1Width + col2Width + 5, yPos + 7);
    doc.text("Tiempo (Parcial)", margin + col1Width + col2Width + col3Width + 5, yPos + 7);
    
    yPos += 10;
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "normal");

    balizaCodes.forEach((code, index) => {
      // Alternating background
      if (index % 2 === 1) {
        doc.setFillColor(249, 250, 251); // Gray-50
        doc.rect(margin, yPos, contentWidth, 8, "F");
      }
      
      const isCorrect = normalizeString(code) === normalizeString(selectedRoute.codes[index]);
      const splitTimeRaw = results.balizaTimes[index] - startTime;
      const splitTime = formatTime(Math.floor(splitTimeRaw / 1000));
      
      doc.text(`Baliza ${index + 1}`, margin + 5, yPos + 6);
      doc.text(code || "-", margin + col1Width + 5, yPos + 6);
      
      if (isCorrect) {
        doc.setTextColor(16, 185, 129); // Green
        doc.text("Acertado", margin + col1Width + col2Width + 5, yPos + 6);
      } else {
        doc.setTextColor(220, 38, 38); // Red
        doc.text("Fallado", margin + col1Width + col2Width + 5, yPos + 6);
      }
      
      doc.setTextColor(31, 41, 55);
      doc.text(splitTime, margin + col1Width + col2Width + col3Width + 5, yPos + 6);
      
      yPos += 8;
      
      // Check for page break
      if (yPos > pageHeight - margin - 20) {
        doc.addPage();
        yPos = margin;
      }
    });
    
    yPos += 15;

    // Section: Recorrido Realizado (Map)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("RECORRIDO REALIZADO", margin, yPos);
    yPos += 2;
    doc.line(margin, yPos, margin + 60, yPos);
    yPos += 10;
    
    // Load and add the map image
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = selectedRoute.mapUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      const imgWidth = contentWidth;
      const imgHeight = (img.height * imgWidth) / img.width;
      
      // Check if image fits on current page
      if (yPos + imgHeight > pageHeight - margin - 20) { // Leave space for footer
        doc.addPage();
        yPos = margin;
      }
      
      doc.addImage(img, "JPEG", margin, yPos, imgWidth, imgHeight);
    } catch (error) {
      console.error("Error loading image for PDF:", error);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text("(No se pudo cargar la imagen del mapa en el reporte)", margin, yPos);
    }

    // --- Footer and Pagination ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(150, 150, 150);
      
      // Footer text
      doc.text("Proyecto de Orientación Escolar", margin, pageHeight - 10);
      
      // Pagination
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    }
    
    doc.save(`Reporte_Orientacion_${userData.nombre}_${userData.apellidos}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // --- Render Screens ---

  const renderHome = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-50"
    >
      <div className="max-w-md mx-auto px-6 py-8">
        {/* Main Title Section */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-gray-900 mb-1">Recorridos de Orientación</h2>
          <div className="flex items-center justify-center gap-3">
            <div className="h-[1px] w-8 bg-[#009688]/30"></div>
            <p className="text-sm font-bold text-[#009688]">IES LUCÍA DE MEDRANO</p>
            <div className="h-[1px] w-8 bg-[#009688]/30"></div>
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Departamento de Educación Física</p>
        </div>

        {/* Hero Card with Ken Burns effect */}
        <div className="mb-10 relative overflow-hidden rounded-[32px] shadow-2xl shadow-[#009688]/10 border-4 border-white aspect-[16/10]">
          <div className="absolute inset-0 overflow-hidden">
            <img 
              src="https://raw.githubusercontent.com/josecarlostejedor/ISLA-SOTO-ORIENTACION/main/recorridoorienta.jpg" 
              alt="Orientación" 
              className="w-full h-full object-cover animate-ken-burns"
              referrerPolicy="no-referrer"
            />
          </div>
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          
          {/* Overlay Text */}
          <div className="absolute bottom-6 left-6 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">LOCALIZACIÓN</p>
            <h3 className="text-xl font-bold">Isla del Soto, Salamanca.</h3>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-6 bg-red-800 rounded-full"></div>
            <h3 className="text-lg font-bold text-gray-800">Datos del Corredor</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Nombre</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-800/20 focus:border-red-800 outline-none transition-all shadow-sm"
                placeholder="Ej: Juan"
                value={userData.nombre}
                onChange={(e) => setUserData({...userData, nombre: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Apellidos</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-800/20 focus:border-red-800 outline-none transition-all shadow-sm"
                placeholder="Ej: Pérez García"
                value={userData.apellidos}
                onChange={(e) => setUserData({...userData, apellidos: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Edad</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-800/20 focus:border-red-800 outline-none transition-all shadow-sm"
                  placeholder="14"
                  value={userData.edad}
                  onChange={(e) => setUserData({...userData, edad: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Grupo</label>
                <select 
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-800/20 focus:border-red-800 outline-none transition-all appearance-none shadow-sm"
                  value={userData.grupo}
                  onChange={(e) => setUserData({...userData, grupo: e.target.value})}
                >
                  <option value="">Selecciona...</option>
                  {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Curso</label>
              <select 
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-800/20 focus:border-red-800 outline-none transition-all appearance-none shadow-sm"
                value={userData.curso}
                onChange={(e) => setUserData({...userData, curso: e.target.value})}
              >
                <option value="">Selecciona...</option>
                {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button 
            onClick={() => {
              if (userData.nombre && userData.apellidos && userData.curso && userData.grupo) {
                setScreen("ROUTE_SELECTION");
              } else {
                alert("Por favor, completa todos los campos requeridos.");
              }
            }}
            className="w-full bg-red-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-800/20 hover:bg-red-900 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
          >
            Continuar
            <ChevronRight className="w-5 h-5" />
          </button>

          {(userData.nombre || selectedRoute) && (
            <button 
              onClick={handleResetApp}
              className="w-full mt-4 py-3 text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-red-800 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-3 h-3" />
              Reiniciar aplicación / Borrar datos
            </button>
          )}
        </div>
        <Footer />
      </div>
    </motion.div>
  );

  const renderRouteSelection = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-md mx-auto px-6 py-8"
    >
      <div className="bg-gray-50 p-4 rounded-2xl mb-8 border border-gray-100 flex items-center gap-4">
        <div className="bg-red-800/10 p-3 rounded-full">
          <User className="w-6 h-6 text-red-800" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{userData.nombre} {userData.apellidos}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{userData.curso} - Grupo {userData.grupo} ({userData.edad} años)</p>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-800 mb-6 border-l-4 border-red-800 pl-3">Selecciona un Recorrido</h3>
      
      <div className="grid grid-cols-1 gap-4">
        {ROUTES.map((route) => (
          <button
            key={route.id}
            onClick={() => setSelectedRoute(route)}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
              selectedRoute?.id === route.id 
                ? "border-red-800 bg-red-50/50 shadow-md" 
                : "border-gray-100 bg-white hover:border-gray-200"
            }`}
          >
            <div>
              <p className="font-bold text-gray-900">{route.name}</p>
              <p className="text-xs text-gray-500 font-medium">{route.balizas} Balizas</p>
            </div>
            {selectedRoute?.id === route.id && <CheckCircle2 className="w-6 h-6 text-red-800" />}
          </button>
        ))}
      </div>

      {selectedRoute && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <button 
            onClick={handleStartRace}
            className="w-full bg-red-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-800/20 hover:bg-red-900 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Comenzar Carrera
            <Timer className="w-5 h-5" />
          </button>
        </motion.div>
      )}
      
      <button 
        onClick={() => setScreen("HOME")}
        className="w-full mt-4 py-3 text-gray-400 text-xs font-bold uppercase tracking-widest hover:text-gray-600 transition-colors"
      >
        Volver atrás
      </button>
    </motion.div>
  );

  const renderRace = () => {
    const onUpdate = ({ x, y, scale }: { x: number; y: number; scale: number }) => {
      const img = document.querySelector(".map-image") as HTMLImageElement;
      if (img) {
        img.style.transform = make3dTransformValue({ x, y, scale });
      }
    };

    return (
      <div className="fixed inset-0 flex flex-col bg-gray-900 overflow-hidden z-50">
        <div 
          className="bg-white p-4 flex items-center justify-between shadow-lg z-30 border-b border-gray-100"
          style={{ 
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
            minHeight: 'calc(env(safe-area-inset-top, 0px) + 5rem)'
          }}
        >
          <div className="flex-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Recorrido</p>
            <p className="font-bold text-gray-900 truncate leading-tight">{selectedRoute?.name}</p>
          </div>
          <div className="text-right flex-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Tiempo</p>
            <p className="font-mono text-xl font-bold text-red-800 leading-none">{formatTime(elapsedTime)}</p>
          </div>
        </div>

        <div className="flex-1 relative bg-gray-200 overflow-hidden z-10">
          <QuickPinchZoom 
            key={selectedRoute?.id} 
            onUpdate={onUpdate} 
            wheelScaleFactor={1000}
            maxZoom={8}
            containerProps={{
              style: {
                width: "100%",
                height: "100%",
              }
            }}
          >
            <img 
              src={selectedRoute?.mapUrl} 
              alt="Mapa" 
              className="map-image w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onLoad={() => {
                window.dispatchEvent(new Event('resize'));
              }}
            />
          </QuickPinchZoom>
          <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest pointer-events-none z-20">
            Usa dos dedos para zoom
          </div>
        </div>

        <div className="bg-white p-6 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-30 pb-[calc(env(safe-area-inset-bottom, 0px) + 1.5rem)]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              Baliza <span className="text-red-800 text-lg">{currentBaliza}</span> de {selectedRoute?.balizas}
            </h4>
            <div className="flex gap-1">
              {[...Array(selectedRoute?.balizas)].map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 w-4 rounded-full transition-all ${i + 1 <= currentBaliza ? "bg-red-800" : "bg-gray-100"}`} 
                />
              ))}
            </div>
          </div>

          <p className="text-red-800 font-bold text-sm mb-1 uppercase tracking-tight">Ingresa el código del control</p>
          
          {selectedRoute && (selectedRoute.id === 1 || selectedRoute.id === 2 || selectedRoute.id === 3) && (
            <div className="mb-3">
              <p className="text-[10px] text-gray-400 font-medium italic leading-tight">
                Bienvenidos a nuestro recorrido BUSCANDO LUCIÉRNAGAS ARTIFICIALES ENTRE ROCAS NATURALES
              </p>
              <p className="text-[10px] text-red-900 font-bold italic mt-1 leading-tight">
                El formato de código que debes ingresar será del tipo 0000-000 cuando sea numérico
              </p>
            </div>
          )}
          
          {selectedRoute && (selectedRoute.id === 4 || selectedRoute.id === 5 || selectedRoute.id === 6) && (
            <div className="mb-3">
              <p className="text-[10px] text-gray-400 font-medium italic leading-tight">
                Bienvenidos a nuestro recorrido EN BUSCA DE LOS ÁRBOLES Y PLANTAS SINGULARES
              </p>
              <p className="text-[10px] text-red-900 font-bold italic mt-1 leading-tight">
                El texto a incluir son nombres de plantas o árboles
              </p>
            </div>
          )}
          
          <div className="flex gap-3">
            <input 
              type="text" 
              autoFocus
              className="flex-1 px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-800/20 focus:border-red-800 outline-none transition-all text-center font-bold text-xl uppercase"
              placeholder="CÓDIGO"
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === "Enter" && currentCode && handleNextBaliza()}
            />
            <button 
              onClick={handleNextBaliza}
              disabled={!currentCode}
              className={`px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                currentCode 
                  ? "bg-red-800 text-white shadow-lg shadow-red-800/20" 
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
            >
              {currentBaliza === selectedRoute?.balizas ? "FIN" : "SIG."}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderBorgScale = () => {
    const getBorgColor = (val: number) => {
      if (val <= 3) return "#10b981"; // emerald-500
      if (val <= 6) return "#f59e0b"; // amber-500
      if (val <= 8) return "#f97316"; // orange-500
      return "#dc2626"; // red-600
    };

    const getBorgLabel = (val: number) => {
      if (val <= 2) return "Muy suave";
      if (val <= 4) return "Suave";
      if (val <= 6) return "Moderado";
      if (val <= 8) return "Duro";
      return "Muy duro / Máximo";
    };

    const color = getBorgColor(borgScale);

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto px-6 py-12 flex flex-col items-center text-center h-screen justify-center"
      >
        <div 
          className="p-6 rounded-full mb-6 transition-all duration-500"
          style={{ backgroundColor: `${color}20` }}
        >
          <Activity className="w-12 h-12 transition-colors duration-500" style={{ color }} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Escala de Borg</h2>
        <p className="text-gray-500 mb-12">¿Nivel de fatiga percibida?</p>

        <div className="w-full space-y-8 mb-16">
          <div className="relative">
            <motion.div 
              key={borgScale}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-8xl font-black transition-colors duration-500" 
              style={{ 
                color,
                textShadow: `0 0 20px ${color}40`
              }}
            >
              {borgScale}
            </motion.div>
            <p className="text-sm font-bold uppercase tracking-widest mt-2 transition-colors duration-500" style={{ color }}>
              {getBorgLabel(borgScale)}
            </p>
          </div>
          
          <div className="relative pt-1 px-4">
            <input 
              type="range" 
              min="1" 
              max="10" 
              step="1"
              className="w-full h-4 rounded-full appearance-none cursor-pointer transition-all duration-500"
              style={{ 
                background: `linear-gradient(to right, ${color} ${borgScale * 10}%, #e5e7eb ${borgScale * 10}%)`,
                boxShadow: `0 4px 12px ${color}20`
              }}
              value={borgScale}
              onChange={(e) => setBorgScale(parseInt(e.target.value))}
            />
            <div className="flex justify-between text-[10px] font-bold text-gray-400 mt-6 px-1">
              <span className={borgScale === 1 ? "text-gray-900 scale-110" : ""}>NADA (1)</span>
              <span className={borgScale === 5 ? "text-gray-900 scale-110" : ""}>MEDIO (5)</span>
              <span className={borgScale === 10 ? "text-gray-900 scale-110" : ""}>MÁXIMO (10)</span>
            </div>
          </div>
        </div>

        <button 
          onClick={calculateResults}
          className="w-full text-white font-bold py-5 rounded-2xl shadow-xl transition-all duration-500 flex items-center justify-center gap-3 active:scale-[0.98]"
          style={{ 
            backgroundColor: color,
            boxShadow: `0 10px 25px ${color}40`
          }}
        >
          Ver Resultados
          <Trophy className="w-6 h-6" />
        </button>
      </motion.div>
    );
  };

  const renderResults = () => {
    if (!results) return null;
    const score = ((results.hits / results.totalBalizas) * 10).toFixed(1);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto px-6 py-12"
      >
        <div className="text-center mb-10">
          <div className="inline-block p-4 bg-amber-100 rounded-full mb-4">
            <Trophy className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">¡Carrera Finalizada!</h2>
          <p className="text-gray-500 font-medium tracking-wide uppercase text-xs">Resultados de {userData.nombre}</p>
        </div>

        <div className="bg-white rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden mb-8">
          <div className="bg-red-800 py-8 text-center text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-2">Puntuación Final</p>
            <div className="text-7xl font-black tracking-tighter">
              {score}<span className="text-2xl opacity-50 font-medium">/10</span>
            </div>
            
            {/* Submission Status Message */}
            <div className="mt-4 px-4">
              {submissionStatus === "SUBMITTING" && (
                <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/70 animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                  Enviando a Google Sheets...
                </div>
              )}
              {submissionStatus === "SUCCESS" && (
                <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  <div className="w-2 h-2 bg-emerald-300 rounded-full" />
                  Datos guardados correctamente
                </div>
              )}
              {submissionStatus === "ERROR" && (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                    <div className="w-2 h-2 bg-amber-300 rounded-full" />
                    Error al guardar datos
                  </div>
                  <p className="text-[8px] text-white/50 uppercase tracking-tighter">{errorMessage}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-50 pb-4">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 text-gray-400" />
                <p className="text-sm font-medium text-gray-500">Tiempo empleado</p>
              </div>
              <p className="font-bold text-gray-900">{formatTime(results.timeTaken)}</p>
            </div>
            
            <div className="flex items-center justify-between border-b border-gray-50 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-gray-400" />
                <p className="text-sm font-medium text-gray-500">Número de aciertos</p>
              </div>
              <p className="font-bold text-gray-900">{results.hits} / {results.totalBalizas}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <p className="text-sm font-medium text-gray-500">Curso y Grupo</p>
              </div>
              <p className="font-bold text-gray-900">{userData.curso} - {userData.grupo}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button 
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className={`w-full text-white font-bold py-5 rounded-2xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${isGeneratingPDF ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'}`}
          >
            {isGeneratingPDF ? "Generando PDF..." : "Descargar en PDF"}
            {isGeneratingPDF ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
          </button>
          
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => {
                setScreen("ROUTE_SELECTION");
                setResults(null);
                setSubmissionStatus("IDLE");
                setStartTime(null);
                setEndTime(null);
                setElapsedTime(0);
                setBalizaCodes([]);
                setBalizaTimes([]);
                setCurrentBaliza(1);
                setCurrentCode("");
                
                // Update persistence explicitly for "Nueva Carrera"
                const savedState = localStorage.getItem("orienteering_app_state");
                if (savedState) {
                  const state = JSON.parse(savedState);
                  localStorage.setItem("orienteering_app_state", JSON.stringify({
                    ...state,
                    screen: "ROUTE_SELECTION",
                    results: null,
                    startTime: null,
                    endTime: null,
                    currentBaliza: 1,
                    balizaCodes: [],
                    balizaTimes: []
                  }));
                }
              }}
              className="bg-red-800 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-800/20 hover:bg-red-900 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Nueva Carrera
            </button>
            
            <button 
              onClick={() => {
                setScreen("HOME");
                setUserData({ nombre: "", apellidos: "", edad: "", curso: "", grupo: "" });
                setResults(null);
                setSubmissionStatus("IDLE");
              }}
              className="bg-white border-2 border-gray-100 text-gray-600 font-bold py-4 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              Cambiar Corredor
            </button>
          </div>
        </div>
        
        <Footer />
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-red-800 selection:text-white">
      {screen !== "RACE" && <Header />}
      
      <main>
        <AnimatePresence mode="wait">
          {screen === "HOME" && renderHome()}
          {screen === "ROUTE_SELECTION" && renderRouteSelection()}
          {screen === "RACE" && renderRace()}
          {screen === "BORG_SCALE" && renderBorgScale()}
          {screen === "RESULTS" && renderResults()}
        </AnimatePresence>
      </main>
    </div>
  );
}
