
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  Upload, 
  ChevronRight,
  Sparkles,
  Search,
  BarChart3,
  Layers,
  LayoutDashboard,
  Trash2,
  School,
  FileSpreadsheet,
  Image as ImageIcon,
  Award,
  Trophy,
  Target,
  X,
  Star,
  Zap,
  TrendingDown,
  BookOpen,
  SlidersHorizontal,
  RefreshCcw,
  ArrowRight,
  FileText,
  Loader2,
  BrainCircuit,
  UserCheck,
  Lightbulb,
  AlertCircle,
  WifiOff,
  Cpu,
  User
} from 'lucide-react';
import { StudentData, ClassStats, StudentClassification, SubjectScore } from './types';
import { processRawStudentData, calculateClassificationAndGoals, getSubjectLevel, getRadarData } from './gradingService';
import { getPedagogicalAdvice } from './geminiService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis
} from 'recharts';

// Hàm hỗ trợ loại bỏ dấu tiếng Việt để đặt tên file an toàn
const sanitizeFilename = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');
};

const App: React.FC = () => {
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassification, setSelectedClassification] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<string>("SUMMARY"); 
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<StudentData | null>(null);
  
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [adviceSource, setAdviceSource] = useState<'AI' | 'Local' | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [simulatingStudent, setSimulatingStudent] = useState<StudentData | null>(null);
  const [simulatedScores, setSimulatedScores] = useState<SubjectScore[]>([]);

  const reportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const batchCardRef = useRef<HTMLDivElement>(null);
  const [batchTargetStudent, setBatchTargetStudent] = useState<StudentData | null>(null);

  const APP_NAME = "Trợ lý phân tích số liệu điểm thi";
  const APP_SUBTITLE = "Phân tích năng lực và quyết định sư phạm";
  const AUTHOR_INFO = "Tác giả: Trương Thị Hương - Trường PTDTNT THPT Mường Ảng - 0989550411";

  const classificationPriority: Record<string, number> = {
    [StudentClassification.TOT]: 1,
    [StudentClassification.TIEM_CAN_TOT]: 2,
    [StudentClassification.KHA]: 3,
    [StudentClassification.TIEM_CAN_KHA]: 4,
    [StudentClassification.DAT]: 5,
    [StudentClassification.TIEM_CAN_DAT]: 6,
    [StudentClassification.CHUA_DAT]: 7,
  };

  const classGroups = useMemo(() => {
    const groups: Record<string, StudentData[]> = {};
    allStudents.forEach(s => {
      const cls = s.className || "Chưa rõ";
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(s);
    });
    return groups;
  }, [allStudents]);

  const sortedClassNames = useMemo(() => Object.keys(classGroups).sort(), [classGroups]);

  const currentViewStudents = useMemo(() => {
    if (activeTab === "SUMMARY") return allStudents;
    return classGroups[activeTab] || [];
  }, [allStudents, classGroups, activeTab]);

  const filteredStudents = useMemo(() => {
    return currentViewStudents.filter(s => {
      const name = s.name || "";
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = selectedClassification === "All" || s.classification === selectedClassification;
      return name !== "" && matchesSearch && matchesFilter;
    });
  }, [currentViewStudents, searchTerm, selectedClassification]);

  const stats = useMemo((): ClassStats => {
    const list = currentViewStudents;
    return {
      total: list.length,
      totCount: list.filter(s => s.classification === StudentClassification.TOT).length,
      tiemCanTotCount: list.filter(s => s.classification === StudentClassification.TIEM_CAN_TOT).length,
      khaCount: list.filter(s => s.classification === StudentClassification.KHA).length,
      tiemCanKhaCount: list.filter(s => s.classification === StudentClassification.TIEM_CAN_KHA).length,
      datCount: list.filter(s => s.classification === StudentClassification.DAT).length,
      tiemCanDatCount: list.filter(s => s.classification === StudentClassification.TIEM_CAN_DAT).length,
      chuaDatCount: list.filter(s => s.classification === StudentClassification.CHUA_DAT).length,
    };
  }, [currentViewStudents]);

  const subjectAverages = useMemo(() => {
    if (currentViewStudents.length === 0) return [];
    const subjectStats: Record<string, { total: number; count: number }> = {};
    currentViewStudents.forEach(s => {
      s.scores.forEach(scoreObj => {
        if (!subjectStats[scoreObj.name]) subjectStats[scoreObj.name] = { total: 0, count: 0 };
        if (scoreObj.score >= 0) {
          subjectStats[scoreObj.name].total += scoreObj.score;
          subjectStats[scoreObj.name].count += 1;
        }
      });
    });
    return Object.entries(subjectStats)
      .map(([name, stat]) => ({ name, average: stat.count > 0 ? stat.total / stat.count : 0 }))
      .sort((a, b) => a.average - b.average);
  }, [currentViewStudents]);

  const handleFetchAiAdvice = async () => {
    if (currentViewStudents.length === 0) return;
    setIsAiLoading(true);
    const result = await getPedagogicalAdvice(stats);
    setAiAdvice(result.text);
    setAdviceSource(result.source);
    setIsAiLoading(false);
  };

  useEffect(() => {
    setAiAdvice("");
    setAdviceSource(null);
  }, [activeTab]);

  useEffect(() => {
    if (simulatingStudent) setSimulatedScores([...simulatingStudent.scores]);
  }, [simulatingStudent]);

  const simulationResult = useMemo(() => {
    if (!simulatingStudent || simulatedScores.length === 0) return null;
    return calculateClassificationAndGoals(simulatedScores);
  }, [simulatingStudent, simulatedScores]);

  const updateSimulatedScore = (subjectName: string, newScore: number) => {
    setSimulatedScores(prev => prev.map(s => 
      s.name === subjectName ? { ...s, score: newScore, level: getSubjectLevel(newScore) } : s
    ));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        let newProcessedStudents: StudentData[] = [];
        let newSubjectHeaders: Set<string> = new Set();
        wb.SheetNames.forEach(wsname => {
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json<any>(ws, { blankrows: false });
          if (jsonData.length === 0) return;
          const allHeaders = Object.keys(jsonData[0]);
          const nameKey = allHeaders.find(h => ['họ tên', 'họ và tên', 'tên'].includes(h.trim().toLowerCase())) || 'Họ tên';
          const classKey = allHeaders.find(h => ['lớp'].includes(h.trim().toLowerCase())) || 'Lớp';
          const sttKey = allHeaders.find(h => ['stt', 'id'].includes(h.trim().toLowerCase())) || 'STT';
          const subjectHeaders = allHeaders.filter(h => ![sttKey, nameKey, classKey].includes(h));
          subjectHeaders.forEach(h => newSubjectHeaders.add(h));
          const processed = jsonData.map(item => {
            if (!item[classKey]) item[classKey] = wsname;
            return processRawStudentData(item, subjectHeaders, { nameKey, classKey, sttKey });
          }).filter((s): s is StudentData => s !== null);
          newProcessedStudents = [...newProcessedStudents, ...processed];
        });
        setHeaders(prev => Array.from(new Set([...prev, ...Array.from(newSubjectHeaders)])));
        setAllStudents(prev => [...prev, ...newProcessedStudents]);
      } catch (err) { console.error(err); } finally { setLoading(false); e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportToExcelFormatted = () => {
    const wb = XLSX.utils.book_new();
    const sourceData = activeTab === "SUMMARY" ? allStudents : (classGroups[activeTab] || []);
    const sortedData = [...sourceData].sort((a, b) => (classificationPriority[a.classification] || 99) - (classificationPriority[b.classification] || 99));

    const excelRows = sortedData.map((s, index) => {
      const row: any = {
        'STT': index + 1,
        'Họ và Tên': s.name,
        'Lớp': s.className,
        'Xếp loại (TT22)': s.classification,
        'GV Chủ nhiệm': teacherNames[s.className] || '',
      };
      s.scores.forEach(scoreObj => { row[scoreObj.name] = scoreObj.score; });
      row['Mục tiêu bứt phá (Học kỳ tới)'] = s.goals.length > 0 
        ? s.goals.map(g => `${g.subjectName}: ${g.currentScore} → ${g.targetScore.toFixed(1)}`).join('; ')
        : (s.classification === StudentClassification.TOT ? "Duy trì phong độ Tốt nâng cao." : "Cần nỗ lực cải thiện đều các môn.");
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, ...headers.map(() => ({ wch: 8 })), { wch: 50 }];
    const sheetName = activeTab === "SUMMARY" ? "Tong_Hop" : `Lop_${activeTab}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sanitizeFilename(APP_NAME)}_${sheetName}.xlsx`);
  };

  const exportBatchPDF = async () => {
    if (filteredStudents.length === 0) return;
    setExporting(true);
    setBatchProgress({ current: 0, total: filteredStudents.length });

    // Sửa lỗi TS2554 bằng cách ép kiểu any cho constructor để bỏ qua kiểm tra số lượng đối số sai lệch của TS
    const pdf = new (jsPDF as any)({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    try {
      for (let i = 0; i < filteredStudents.length; i++) {
        const student = filteredStudents[i];
        setBatchTargetStudent(student);
        setBatchProgress({ current: i + 1, total: filteredStudents.length });
        
        await new Promise(resolve => setTimeout(resolve, 400)); 

        if (batchCardRef.current) {
          const canvas = await html2canvas(batchCardRef.current, {
            scale: 2.0, 
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            removeContainer: true
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.9); 
          if (i > 0) pdf.addPage('landscape', 'mm', 'a4');

          const availableWidth = pdfWidth - (margin * 2);
          const availableHeight = pdfHeight - (margin * 2);
          
          let imgDisplayWidth = availableWidth;
          let imgDisplayHeight = (canvas.height * imgDisplayWidth) / canvas.width;

          if (imgDisplayHeight > availableHeight) {
            imgDisplayHeight = availableHeight;
            imgDisplayWidth = (canvas.width * imgDisplayHeight) / canvas.height;
          }

          const xPos = (pdfWidth - imgDisplayWidth) / 2;
          const yPos = (pdfHeight - imgDisplayHeight) / 2;

          pdf.addImage(imgData, 'JPEG', xPos, yPos, imgDisplayWidth, imgDisplayHeight);
          
          canvas.width = 0;
          canvas.height = 0;
        }
      }
      
      const safeTabName = sanitizeFilename(activeTab);
      const timestamp = new Date().getTime();
      pdf.save(`Radar_${safeTabName}_${timestamp}.pdf`);
      
    } catch (err) { 
      console.error(err); 
      alert("Đã xảy ra lỗi khi tạo PDF. Vui lòng thử lại với số lượng học sinh ít hơn."); 
    } finally { 
      setExporting(false); 
      setBatchProgress(null); 
      setBatchTargetStudent(null); 
    }
  };

  const downloadStudentCard = async () => {
    if (!cardRef.current || !selectedStudentForCard) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, { 
        scale: 2.5, 
        useCORS: true, 
        backgroundColor: null,
        logging: false 
      });
      const link = document.createElement('a');
      const safeName = sanitizeFilename(selectedStudentForCard.name);
      link.download = `The_Radar_${safeName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) { console.error(err); } finally { setExporting(false); }
  };

  const updateTeacherName = (className: string, name: string) => {
    setTeacherNames(prev => ({ ...prev, [className]: name }));
  };

  const chartData = [
    { name: 'Tốt', value: stats.totCount, fill: '#10b981' },
    { name: 'TC Tốt', value: stats.tiemCanTotCount, fill: '#3b82f6' },
    { name: 'Khá', value: stats.khaCount, fill: '#6366f1' },
    { name: 'TC Khá', value: stats.tiemCanKhaCount, fill: '#a855f7' },
    { name: 'Đạt', value: stats.datCount, fill: '#eab308' },
    { name: 'TC Đạt', value: stats.tiemCanDatCount, fill: '#f97316' },
    { name: 'Chưa đạt', value: stats.chuaDatCount, fill: '#f43f5e' },
  ];

  const getClassificationStyles = (cls: StudentClassification) => {
    switch (cls) {
      case StudentClassification.TOT: return 'bg-emerald-500 text-white border-emerald-400';
      case StudentClassification.TIEM_CAN_TOT: return 'bg-blue-500 text-white border-blue-400';
      case StudentClassification.KHA: return 'bg-indigo-500 text-white border-indigo-400';
      case StudentClassification.TIEM_CAN_KHA: return 'bg-purple-500 text-white border-purple-400';
      case StudentClassification.DAT: return 'bg-amber-500 text-white border-amber-400';
      case StudentClassification.TIEM_CAN_DAT: return 'bg-orange-500 text-white border-orange-400';
      case StudentClassification.CHUA_DAT: return 'bg-rose-500 text-white border-rose-400';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getAverageColor = (avg: number) => {
    if (avg >= 8.0) return 'bg-emerald-500';
    if (avg >= 6.5) return 'bg-indigo-500';
    if (avg >= 5.0) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  // Sửa lỗi TS2322: Chấp nhận RefObject<HTMLDivElement | null>
  const CardUI = ({ student, innerRef }: { student: StudentData, innerRef?: React.RefObject<HTMLDivElement | null> }) => {
    const radarData = getRadarData(student.scores);
    const teacherName = teacherNames[student.className] || '';
    
    const renderPolarAngleAxis = ({ payload, x, y, cx, cy }: any) => {
      const dataPoint = radarData.find(d => d.subject === payload.value);
      const score = dataPoint ? dataPoint.A.toFixed(1) : "";
      
      return (
        <g transform={`translate(${x},${y})`}>
          <text x={0} y={0} dy={4} textAnchor={x > cx ? 'start' : x < cx ? 'end' : 'middle'} className="fill-slate-600 text-[10px] font-black">{payload.value}</text>
          <text x={0} y={12} dy={4} textAnchor={x > cx ? 'start' : x < cx ? 'end' : 'middle'} className="fill-indigo-600 text-[9px] font-black">({score})</text>
        </g>
      );
    };

    return (
      <div ref={innerRef} className="p-10 bg-white overflow-hidden relative w-[1000px]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/5 rounded-full -mr-40 -mt-40 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
        <div className="relative border-8 border-double border-slate-100 rounded-[48px] p-10">
          <div className="flex justify-between items-start mb-10">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-indigo-600 rounded-3xl shadow-2xl shadow-indigo-200"><BrainCircuit className="w-12 h-12 text-white" /></div>
              <div>
                <h4 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Hồ Sơ Năng Lực Đa Chiều</h4>
                <p className="text-xs font-black text-indigo-500 uppercase tracking-[0.3em]">{APP_NAME}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Lớp: <span className="text-slate-900">{student.className}</span></p>
              {teacherName && <p className="text-sm font-black text-indigo-500 uppercase tracking-widest">GVCN: {teacherName}</p>}
            </div>
          </div>
          <div className="mb-12">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Học sinh vinh danh</p>
            <h3 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">{student.name}</h3>
            <div className="flex items-center gap-4">
              <span className={`px-6 py-2 rounded-2xl text-sm font-black uppercase tracking-[0.1em] border-2 shadow-xl ${getClassificationStyles(student.classification)}`}>{student.classification}</span>
              <div className="h-px flex-1 bg-slate-200"></div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => <Star key={i} className={`w-4 h-4 ${i < (student.classification === StudentClassification.TOT ? 5 : 4) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-12 items-center mb-10">
            <div className="col-span-4 space-y-8">
              <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 shadow-inner">
                <h5 className="flex items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-widest mb-6"><Target className="w-5 h-5 text-rose-500" /> Chiến lược bứt phá</h5>
                <div className="space-y-4">
                  {student.goals.length > 0 ? student.goals.map((g, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <span className="text-xs font-black text-slate-700">{g.subjectName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-300 line-through">{g.currentScore}</span>
                        <ChevronRight className="w-3 h-3 text-indigo-400" />
                        <span className="text-sm font-black text-emerald-600">{g.targetScore.toFixed(1)}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center text-center gap-3">
                      <Trophy className="w-8 h-8 text-emerald-500" />
                      <p className="text-xs font-black text-emerald-700 uppercase leading-relaxed">Duy trì và phát huy thế mạnh toàn diện</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-2xl relative overflow-hidden">
                <Zap className="absolute -right-6 -bottom-6 w-32 h-32 text-indigo-500/10" />
                <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Lời khuyên sư phạm</h5>
                <p className="text-sm font-medium leading-relaxed italic relative z-10 text-slate-300">"Sự nỗ lực bền bỉ là chìa khóa mở cánh cửa tri thức."</p>
              </div>
            </div>
            <div className="col-span-8 h-[500px] flex items-center justify-center bg-white rounded-[48px] border-4 border-slate-50 shadow-2xl p-6 relative">
              <div className="absolute top-6 left-6 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Biểu đồ Năng lực (0 - 10)</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" strokeWidth={1} />
                  <PolarAngleAxis dataKey="subject" tick={renderPolarAngleAxis} />
                  <PolarRadiusAxis angle={90} domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar name={student.name} dataKey="A" stroke="#4f46e5" strokeWidth={4} fill="#4f46e5" fillOpacity={0.4} dot={{ r: 5, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-indigo-500" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{AUTHOR_INFO}</p>
            </div>
            <div className="flex items-center gap-2">
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-300 uppercase leading-none">Phát triển bởi</p>
                  <p className="text-xs font-black text-slate-900 leading-none">Hệ thống phân tích điểm thi</p>
               </div>
               <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center font-black text-white text-lg">H</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" translate="no">
      {batchProgress && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center space-y-6 max-w-sm w-full mx-4">
            <div className="relative w-24 h-24 mx-auto">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-slate-100 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                <circle className="text-indigo-600 stroke-current transition-all duration-300" strokeWidth="8" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * batchProgress.current) / batchProgress.total}></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-black text-slate-900">
                {batchProgress.current === batchProgress.total ? 'Đang nén...' : Math.round((batchProgress.current / batchProgress.total) * 100) + '%'}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {batchProgress.current === batchProgress.total ? 'Đang đóng gói PDF...' : 'Đang xuất Hồ sơ Radar'}
              </h3>
              <p className="text-sm font-bold text-slate-400 mt-1">Đang xử lý: {batchProgress.current} / {batchProgress.total} học sinh</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate">
                {batchProgress.current === batchProgress.total ? 'Chuẩn bị tải xuống...' : `Đang vẽ: ${batchTargetStudent?.name}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed left-[-9999px] top-[-9999px] overflow-hidden" style={{ width: '1000px', height: 'auto' }}>
        {batchTargetStudent && <CardUI student={batchTargetStudent} innerRef={batchCardRef} />}
      </div>

      {simulatingStudent && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4"><div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-100"><SlidersHorizontal className="w-6 h-6 text-white" /></div><div><h3 className="text-2xl font-black text-slate-900">Giả lập Điểm số (What-if)</h3><p className="text-sm font-bold text-slate-400">Dự báo sự thay đổi của <span className="text-indigo-600">{simulatingStudent.name}</span></p></div></div>
              <button onClick={() => setSimulatingStudent(null)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6 text-slate-600" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-10">
              <div className="flex-1 space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Điều chỉnh mức điểm</h4>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                    <AlertCircle className="w-3 h-3" /> Ngưỡng khả quan: +0.5
                  </div>
                </div>
                {simulatedScores.map(s => {
                  const originalScore = simulatingStudent.scores.find(os => os.name === s.name)?.score || 0;
                  const diff = s.score - originalScore;
                  const isChallenging = diff > 0.5;

                  return (
                    <div key={s.name} className={`p-4 rounded-3xl border transition-all hover:shadow-md ${isChallenging ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-black text-slate-700">{s.name}</span>
                        <div className="flex items-center gap-2">
                          {isChallenging && <span className="text-[10px] font-black text-amber-600 uppercase">Thách thức</span>}
                          <input type="number" step="0.1" max="10" min="0" value={s.score} onChange={(e) => updateSimulatedScore(s.name, parseFloat(e.target.value) || 0)} className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm font-black text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                        </div>
                      </div>
                      <input type="range" min="0" max="10" step="0.1" value={s.score} onChange={(e) => updateSimulatedScore(s.name, parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                  );
                })}
              </div>
              <div className="w-full lg:w-80 shrink-0 space-y-6">
                <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden text-center"><h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-6">Kết quả mô phỏng</h4><div className="text-[10px] font-bold text-slate-400 line-through mb-1">{simulatingStudent.classification}</div><ArrowRight className="w-4 h-4 mx-auto text-white/20 mb-1" /><div className={`px-5 py-2 rounded-2xl text-sm font-black uppercase border shadow-lg ${getClassificationStyles(simulationResult?.classification as StudentClassification)}`}>{simulationResult?.classification}</div></div>
                <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-rose-500" /> Cần cố gắng</h4><div className="space-y-4">{simulationResult?.goals.map((g, i) => (<div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-700">{g.subjectName}</span><span className={`text-xs font-black ${g.increment > 0.5 ? 'text-amber-600' : 'text-indigo-600'}`}>+{g.increment.toFixed(1)}</span></div>))}</div></div>
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t flex justify-end gap-4"><button onClick={() => setSimulatingStudent(null)} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition">Hoàn tất mô phỏng</button></div>
          </div>
        </div>
      )}

      {selectedStudentForCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-fit bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <button onClick={() => setSelectedStudentForCard(null)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-20"><X className="w-5 h-5 text-slate-600" /></button>
            <div className="max-h-[90vh] overflow-y-auto"><CardUI student={selectedStudentForCard} innerRef={cardRef} /></div>
            <div className="p-8 bg-slate-50 flex gap-4"><button onClick={downloadStudentCard} disabled={exporting} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-xl shadow-indigo-100">{exporting ? <Loader2 className="w-5 h-4 animate-spin" /> : <ImageIcon className="w-5 h-5" />} Tải Ảnh Thẻ Radar</button><button onClick={() => setSelectedStudentForCard(null)} className="px-8 py-4 bg-white text-slate-600 rounded-2xl font-black text-sm border border-slate-200 hover:bg-slate-50 transition">Đóng</button></div>
          </div>
        </div>
      )}

      <header className="bg-white border-b sticky top-0 z-50 no-print">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200"><BrainCircuit className="w-5 h-5 text-white" /></div><div><h1 className="text-xl font-black text-slate-900 tracking-tight">{APP_NAME}</h1><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">{APP_SUBTITLE}</p></div></div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border no-print">
              <button onClick={exportToExcelFormatted} className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /> <span>Excel</span></button>
              <button onClick={exportBatchPDF} disabled={exporting || allStudents.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold"><FileText className="w-4 h-4 text-rose-500" /> <span>PDF Radar Hàng Loạt</span></button>
            </div>
            <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 text-sm font-bold"><Upload className="w-4 h-4" /> <span>Nạp dữ liệu</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} /></label>
            {allStudents.length > 0 && <button onClick={() => { if(window.confirm("Xóa sạch dữ liệu?")) { setAllStudents([]); setHeaders([]); setActiveTab("SUMMARY"); setTeacherNames({}); } }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>}
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1600px] mx-auto w-full">
        <aside className="w-64 border-r bg-white hidden lg:flex flex-col p-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto no-print">
          <button onClick={() => setActiveTab("SUMMARY")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm mb-6 ${activeTab === "SUMMARY" ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}><LayoutDashboard className="w-4 h-4" /> Tổng hợp số liệu</button>
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Danh sách lớp ({sortedClassNames.length})</h3>
            {sortedClassNames.map(cls => (
              <div key={cls} className="space-y-1 mb-1">
                <button onClick={() => setActiveTab(cls)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === cls ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}><span className="truncate">{cls}</span><span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeTab === cls ? 'bg-indigo-200/50' : 'bg-slate-100'}`}>{classGroups[cls].length}</span></button>
                {activeTab === cls && (<div className="px-2 pt-1 pb-3 animate-in slide-in-from-top-2 duration-300"><div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserCheck className="w-3 h-3" /> GV Chủ nhiệm</label><input type="text" placeholder="Tên GV..." value={teacherNames[cls] || ''} onChange={(e) => updateTeacherName(cls, e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" /></div></div>)}
              </div>
            ))}
          </div>
          <div className="mt-auto pt-6 border-t">
            <p className="text-[9px] font-bold text-slate-400 leading-relaxed italic">{AUTHOR_INFO}</p>
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-hidden">
          {allStudents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
              <School className="w-16 h-16 text-slate-200 mb-6" />
              <h2 className="text-2xl font-black text-slate-900 mb-2">{APP_NAME}</h2>
              <p className="text-slate-500 font-bold mb-4">{APP_SUBTITLE}</p>
              <p className="text-slate-400 text-sm max-w-md">{AUTHOR_INFO}</p>
              <p className="text-slate-400 text-xs mt-8">Tải file điểm để nhận báo cáo phân tích và biểu đồ năng lực đa chiều.</p>
            </div>
          ) : (
            <div className="space-y-8 pedagogical-report" ref={reportRef}>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 mb-1"><Layers className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">{activeTab === "SUMMARY" ? "Tổng hợp" : `Lớp ${activeTab}`}</span></div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Hiệu suất học tập {activeTab === "SUMMARY" ? "Toàn đơn vị" : activeTab}</h2>
                  {activeTab !== "SUMMARY" && teacherNames[activeTab] && (<p className="text-sm font-bold text-indigo-500 mt-1 flex items-center gap-1"><UserCheck className="w-4 h-4" /> GVCN: {teacherNames[activeTab]}</p>)}
                </div>
                <div className="flex gap-2">
                   <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 flex flex-col items-center shadow-sm"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tổng số</span><span className="text-lg font-black">{stats.total}</span></div>
                   <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 flex flex-col items-center shadow-sm"><span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Tốt + TC</span><span className="text-lg font-black text-emerald-600">{stats.totCount + stats.tiemCanTotCount}</span></div>
                </div>
              </div>

              {/* Trợ lý Sư phạm Advisor Section */}
              <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-[40px] p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-indigo-500 rounded-3xl shadow-lg shadow-indigo-500/20">
                        <BrainCircuit className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-white tracking-tight">Trợ lý Sư phạm {adviceSource === 'Local' ? 'Nội bộ' : 'AI'}</h3>
                        <p className="text-xs font-black text-indigo-300 uppercase tracking-[0.2em] flex items-center gap-2">
                          {adviceSource === 'Local' ? <><Cpu className="w-3 h-3" /> Thuật toán Offline</> : <><Sparkles className="w-3 h-3" /> Gemini Flash 3</>}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleFetchAiAdvice} 
                      disabled={isAiLoading}
                      className="px-6 py-3 bg-white text-slate-900 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-xl disabled:opacity-50 group/btn"
                    >
                      {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4 group-hover/btn:rotate-180 transition-transform duration-500" />}
                      {aiAdvice ? "Cập nhật phân tích" : "Bắt đầu phân tích"}
                    </button>
                  </div>

                  {!aiAdvice && !isAiLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                       <Lightbulb className="w-12 h-12 text-indigo-400/50 mb-4 animate-pulse" />
                       <p className="text-slate-400 font-bold max-w-sm">Hệ thống phân tích cơ cấu điểm số và đưa ra khuyến nghị bứt phá.</p>
                    </div>
                  ) : isAiLoading ? (
                    <div className="space-y-4 py-8">
                      <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-white/5 rounded-full w-full animate-pulse delay-75"></div>
                      <div className="h-4 bg-white/5 rounded-full w-5/6 animate-pulse delay-150"></div>
                      <div className="pt-4 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">Đang phân tích dữ liệu sư phạm...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="prose prose-invert prose-sm max-w-none text-slate-200 font-medium leading-relaxed whitespace-pre-wrap">
                        {aiAdvice}
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           {adviceSource === 'Local' ? <WifiOff className="w-4 h-4 text-amber-400" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             {adviceSource === 'Local' ? 'Phân tích hệ thống' : 'Khuyến nghị chiến lược'}
                           </span>
                         </div>
                         <div className="text-[10px] font-bold text-indigo-400 italic">Hỗ trợ ra quyết định sư phạm.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-900 flex items-center gap-2 mb-8"><BarChart3 className="w-5 h-5 text-indigo-600" /> Thống kê Xếp loại</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.filter(d => d.value > 0)}>
                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={40}>{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-6"><h3 className="font-black text-slate-900 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-600" /> Điểm TB Môn</h3><TrendingDown className="w-4 h-4 text-rose-500" /></div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[300px] custom-scrollbar">
                    {subjectAverages.map((sub, idx) => (
                      <div key={sub.name} className="space-y-1.5 group">
                        <div className="flex justify-between items-center text-xs"><span className="font-bold text-slate-700">{idx < 2 && <Target className="w-3 h-3 text-rose-500 inline mr-1" />}{sub.name}</span><span className={`font-black ${sub.average < 5 ? 'text-rose-500' : 'text-slate-900'}`}>{sub.average.toFixed(2)}</span></div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${getAverageColor(sub.average)}`} style={{ width: `${(sub.average / 10) * 100}%` }}></div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <h3 className="text-xl font-black text-slate-900">Chi tiết Năng lực học sinh</h3>
                  <div className="flex gap-3 no-print">
                    <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input type="text" placeholder="Tìm tên..." className="pl-11 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm w-full sm:w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    <select className="px-6 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-600 appearance-none shadow-sm" value={selectedClassification} onChange={(e) => setSelectedClassification(e.target.value)}><option value="All">Tất cả</option>{Object.values(StudentClassification).map(v => <option key={v} value={v}>{v}</option>)}</select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                      <tr><th className="px-8 py-5">Học sinh</th><th className="px-8 py-5">Xếp loại</th><th className="px-8 py-5">Dự báo</th><th className="px-8 py-5 text-right no-print">Thao tác</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredStudents.sort((a,b) => (classificationPriority[a.classification] || 99) - (classificationPriority[b.classification] || 99)).map(s => (
                        <tr key={`${s.className}-${s.id}-${s.name}`} className="hover:bg-indigo-50/30 transition-all group">
                          <td className="px-8 py-6"><div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{s.name}</div><div className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded w-fit mt-1">{s.className}</div></td>
                          <td className="px-8 py-6"><span className={`px-3 py-1 rounded-xl text-[12px] font-black border shadow-sm ${getClassificationStyles(s.classification)}`}>{s.classification}</span></td>
                          <td className="px-8 py-6"><button onClick={() => setSimulatingStudent(s)} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-all font-black text-xs border border-amber-100"><SlidersHorizontal className="w-4 h-4" /> Mô phỏng</button></td>
                          <td className="px-8 py-6 text-right no-print"><button onClick={() => setSelectedStudentForCard(s)} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all font-black text-xs border border-indigo-100"><BrainCircuit className="w-4 h-4" /> Radar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <footer className="bg-white border-t p-6 no-print">
         <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
               <User className="w-4 h-4" /> {AUTHOR_INFO}
            </div>
            <div className="text-slate-300 text-[10px] font-black uppercase tracking-widest">
               © 2024 - {APP_NAME}
            </div>
         </div>
      </footer>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; background: #4f46e5; cursor: pointer; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
      `}</style>
    </div>
  );
};

export default App;
