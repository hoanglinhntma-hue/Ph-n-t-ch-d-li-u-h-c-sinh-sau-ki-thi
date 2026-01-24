
import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  Upload, 
  Download, 
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
  FileDown,
  Award,
  Trophy,
  Target,
  X,
  Star,
  Zap
} from 'lucide-react';
import { StudentData, ClassStats, StudentClassification } from './types';
import { processRawStudentData } from './gradingService';
import { getPedagogicalAdvice } from './geminiService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from 'recharts';

const App: React.FC = () => {
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassification, setSelectedClassification] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<string>("SUMMARY"); 
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<StudentData | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Thứ tự ưu tiên khi xuất Excel (Tốt cao nhất, Chưa đạt thấp nhất)
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

  const schoolDetailedStats = useMemo(() => {
    return sortedClassNames.map(cls => {
      const students = classGroups[cls];
      return {
        className: cls,
        total: students.length,
        tot: students.filter(s => s.classification === StudentClassification.TOT).length,
        tiemCanTot: students.filter(s => s.classification === StudentClassification.TIEM_CAN_TOT).length,
        kha: students.filter(s => s.classification === StudentClassification.KHA).length,
        tiemCanKha: students.filter(s => s.classification === StudentClassification.TIEM_CAN_KHA).length,
        dat: students.filter(s => s.classification === StudentClassification.DAT).length,
        tiemCanDat: students.filter(s => s.classification === StudentClassification.TIEM_CAN_DAT).length,
        chuaDat: students.filter(s => s.classification === StudentClassification.CHUA_DAT).length,
      };
    });
  }, [classGroups, sortedClassNames]);

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
    
    // Chuẩn bị dữ liệu và sắp xếp theo độ ưu tiên xếp loại
    const sourceData = activeTab === "SUMMARY" ? allStudents : (classGroups[activeTab] || []);
    const sortedData = [...sourceData].sort((a, b) => {
      const pA = classificationPriority[a.classification] || 99;
      const pB = classificationPriority[b.classification] || 99;
      return pA - pB;
    });

    const excelRows = sortedData.map((s, index) => {
      const row: any = {
        'STT': index + 1,
        'Họ và Tên': s.name,
        'Lớp': s.className,
        'Xếp loại (TT22)': s.classification,
      };

      // Thêm điểm các môn
      s.scores.forEach(scoreObj => {
        row[scoreObj.name] = scoreObj.score;
      });

      // Thêm cột mục tiêu bứt phá rõ ràng
      row['Mục tiêu bứt phá (Học kỳ tới)'] = s.goals.length > 0 
        ? s.goals.map(g => `${g.subjectName}: ${g.currentScore} → ${g.targetScore.toFixed(1)}`).join('; ')
        : (s.classification === StudentClassification.TOT ? "Duy trì phong độ Tốt nâng cao." : "Cần nỗ lực cải thiện đều các môn.");

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    
    // Tự động điều chỉnh độ rộng cột cơ bản
    const wscols = [
      { wch: 5 },  // STT
      { wch: 25 }, // Họ tên
      { wch: 10 }, // Lớp
      { wch: 20 }, // Xếp loại
      ...headers.map(() => ({ wch: 8 })), // Các môn học
      { wch: 50 }  // Mục tiêu
    ];
    ws['!cols'] = wscols;

    const sheetName = activeTab === "SUMMARY" ? "Tong_Hop_Toan_Truong" : `Lop_${activeTab}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `EduMind_Bao_Cao_${sheetName}_${new Date().getTime()}.xlsx`);
  };

  const downloadStudentCard = async () => {
    if (!cardRef.current || !selectedStudentForCard) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null
      });
      const link = document.createElement('a');
      link.download = `The_Muc_Tieu_${selectedStudentForCard.name.replace(/\s/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const getMotivationalMessage = (cls: StudentClassification) => {
    switch (cls) {
      case StudentClassification.TOT: return "Bạn đang tỏa sáng rực rỡ! Hãy tiếp tục duy trì ngọn lửa đam mê để vươn tới những đỉnh cao mới.";
      case StudentClassification.TIEM_CAN_TOT: return "Chỉ một chút nỗ lực nữa thôi, đỉnh cao TỐT đang chờ đón bạn. Hãy bứt phá!";
      case StudentClassification.KHA: return "Nền tảng của bạn rất vững chắc. Hãy biến sự nỗ lực thành kết quả vượt trội trong học kỳ tới.";
      case StudentClassification.TIEM_CAN_KHA: return "Cơ hội thăng hạng đang ở ngay trước mắt. Tập trung vào mục tiêu và bạn sẽ thành công!";
      case StudentClassification.DAT: return "Mọi hành trình vạn dặm đều bắt đầu từ một bước chân. Bạn đã sẵn sàng để bứt phá chưa?";
      case StudentClassification.TIEM_CAN_DAT: return "Kiên trì là chìa khóa của thành công. Hãy tập trung cải thiện những môn trọng điểm nhé.";
      default: return "Đừng bỏ cuộc! Mỗi sai lầm là một bài học, mỗi nỗ lực đều đưa bạn gần hơn đến thành công.";
    }
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" translate="no">
      {/* Modal Thẻ Mục Tiêu */}
      {selectedStudentForCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <button 
              onClick={() => setSelectedStudentForCard(null)}
              className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-20"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>

            <div ref={cardRef} className="p-8 bg-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600/5 rounded-full -ml-24 -mb-24 blur-3xl"></div>
              
              <div className="relative border-4 border-double border-slate-200 rounded-[32px] p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                      <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Tấm Vé Bứt Phá</h4>
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">EduMind Student Milestone 2024</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-tighter">Class</p>
                    <p className="text-2xl font-black text-slate-900">{selectedStudentForCard.className}</p>
                  </div>
                </div>

                <div className="mb-10">
                  <p className="text-sm font-bold text-slate-400 uppercase mb-1">Học sinh vinh danh</p>
                  <h3 className="text-4xl font-black text-slate-900 tracking-tight">{selectedStudentForCard.name}</h3>
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${getClassificationStyles(selectedStudentForCard.classification)}`}>
                      {selectedStudentForCard.classification}
                    </span>
                    <div className="h-px flex-1 bg-slate-100"></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <h5 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase mb-4">
                      <Target className="w-4 h-4 text-rose-500" /> Mục tiêu bứt phá
                    </h5>
                    <div className="space-y-3">
                      {selectedStudentForCard.goals.length > 0 ? selectedStudentForCard.goals.map((g, i) => (
                        <div key={i} className="flex items-center justify-between group">
                          <span className="text-sm font-bold text-slate-700">{g.subjectName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 line-through">{g.currentScore}</span>
                            <ChevronRight className="w-3 h-3 text-indigo-400" />
                            <span className="text-sm font-black text-emerald-600">{g.targetScore.toFixed(1)}</span>
                          </div>
                        </div>
                      )) : (
                        <div className="flex items-center gap-3 text-emerald-600">
                          <Star className="w-4 h-4 fill-emerald-600" />
                          <span className="text-sm font-black uppercase">Duy trì phong độ Tốt</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                    <Zap className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10" />
                    <h5 className="text-[10px] font-black text-white/60 uppercase mb-3">Lời nhắn từ EduMind</h5>
                    <p className="text-sm font-medium leading-relaxed italic relative z-10">
                      "{getMotivationalMessage(selectedStudentForCard.classification)}"
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Success is a journey, not a destination</p>
                  </div>
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border-2 border-slate-100">
                    <Award className="w-6 h-6 text-slate-200" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 flex gap-4">
              <button 
                onClick={downloadStudentCard}
                disabled={exporting}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 disabled:opacity-50"
              >
                {exporting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <ImageIcon className="w-5 h-5" />}
                Tải Thẻ Ảnh Mục Tiêu
              </button>
              <button 
                onClick={() => setSelectedStudentForCard(null)}
                className="px-8 py-4 bg-white text-slate-600 rounded-2xl font-black text-sm border border-slate-200 hover:bg-slate-50 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b sticky top-0 z-50 no-print">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">EduMind <span className="text-indigo-600">Enterprise</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Quy chuẩn TT22 & Quyết định sư phạm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border no-print">
               <button 
                 onClick={exportToExcelFormatted}
                 className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold"
               >
                 <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                 <span>Xuất Excel Đẹp</span>
               </button>
            </div>
            <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 text-sm font-bold shrink-0">
              <Upload className="w-4 h-4" /> <span>Nạp dữ liệu</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
            {allStudents.length > 0 && (
              <button onClick={() => { if(window.confirm("Xóa sạch dữ liệu?")) { setAllStudents([]); setHeaders([]); setActiveTab("SUMMARY"); } }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1600px] mx-auto w-full">
        <aside className="w-64 border-r bg-white hidden lg:flex flex-col p-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto no-print">
          <button onClick={() => setActiveTab("SUMMARY")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm mb-6 ${activeTab === "SUMMARY" ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}>
            <LayoutDashboard className="w-4 h-4" /> Tổng hợp trường
          </button>
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Danh sách lớp ({sortedClassNames.length})</h3>
            {sortedClassNames.map(cls => (
              <button key={cls} onClick={() => setActiveTab(cls)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === cls ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>
                <span className="truncate">{cls}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeTab === cls ? 'bg-indigo-200/50' : 'bg-slate-100'}`}>{classGroups[cls].length}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-hidden">
          {allStudents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
              <School className="w-16 h-16 text-slate-200 mb-6" />
              <h2 className="text-2xl font-black text-slate-900 mb-2">Hệ thống hỗ trợ ra quyết định EduMind</h2>
              <p className="text-slate-400 text-sm max-w-md">Tải file điểm chuẩn TT22 để nhận báo cáo thông minh và thẻ mục tiêu truyền cảm hứng cho học sinh.</p>
            </div>
          ) : (
            <div className="space-y-8 pedagogical-report" ref={reportRef}>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 mb-1">
                    <Layers className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{activeTab === "SUMMARY" ? "Toàn trường" : `Lớp ${activeTab}`}</span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{activeTab === "SUMMARY" ? "Báo cáo Chất lượng Hệ thống" : `Phân tích Hiệu suất ${activeTab}`}</h2>
                </div>
                <div className="flex gap-2">
                   <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 flex flex-col items-center shadow-sm">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tổng số</span>
                      <span className="text-lg font-black">{stats.total}</span>
                   </div>
                   <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 flex flex-col items-center shadow-sm">
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Giỏi (Tốt+TC)</span>
                      <span className="text-lg font-black text-emerald-600">{stats.totCount + stats.tiemCanTotCount}</span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-900 flex items-center gap-2 mb-8"><BarChart3 className="w-5 h-5 text-indigo-600" /> Biểu đồ Cơ cấu Năng lực</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.filter(d => d.value > 0)}>
                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={40}>
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-xl relative overflow-hidden">
                  <div className="relative z-10 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-amber-300" /><h3 className="font-bold text-lg">Cố vấn Sư phạm AI</h3></div>
                    <div className="flex-1 flex flex-col justify-center">
                      {aiAdvice[activeTab] ? (
                        <div className="text-xs leading-relaxed text-slate-300 whitespace-pre-line bg-white/5 p-4 rounded-2xl border border-white/10 italic animate-in fade-in">{aiAdvice[activeTab]}</div>
                      ) : (
                        <div className="text-center py-4 no-print">
                          <p className="text-[11px] text-slate-400 mb-6 italic px-4">AI sẽ phân tích các cấp độ xếp loại để đưa ra hướng dẫn phát triển cụ thể.</p>
                          <button onClick={async () => {
                             setAiAdvice(prev => ({ ...prev, [activeTab]: "Đang phân tích..." }));
                             const advice = await getPedagogicalAdvice(stats, currentViewStudents);
                             setAiAdvice(prev => ({ ...prev, [activeTab]: advice }));
                          }} className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black hover:bg-indigo-500 transition shadow-lg">Kích hoạt Phân tích AI</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden" style={{fontFamily: "'Times New Roman', Times, serif", fontSize: "16pt"}}>
                <div className="p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <h3 className="text-xl font-black text-slate-900">Cơ sở dữ liệu học tập</h3>
                  <div className="flex gap-3 no-print">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" placeholder="Tìm tên..." className="pl-11 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm w-full sm:w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <select 
                      className="px-6 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-600 appearance-none shadow-sm"
                      value={selectedClassification}
                      onChange={(e) => setSelectedClassification(e.target.value)}
                    >
                      <option value="All">Tất cả</option>
                      {Object.values(StudentClassification).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                      <tr>
                        <th className="px-8 py-5">Học sinh</th>
                        <th className="px-8 py-5">Xếp loại</th>
                        <th className="px-8 py-5">Cần nỗ lực</th>
                        <th className="px-8 py-5 text-right no-print">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {[...filteredStudents].sort((a,b) => (classificationPriority[a.classification] || 99) - (classificationPriority[b.classification] || 99)).map(s => (
                        <tr key={`${s.className}-${s.id}-${s.name}`} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{s.name}</div>
                            <div className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded w-fit mt-1">{s.className}</div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-xl text-[12px] font-black border shadow-sm ${getClassificationStyles(s.classification)}`}>{s.classification}</span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-sm font-medium text-slate-600 leading-tight">
                              {s.goals.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {s.goals.slice(0, 1).map((g, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="font-black text-slate-700">{g.subjectName}</span>
                                      <ChevronRight className="w-3 h-3 text-indigo-400" />
                                      <span className="text-emerald-600 font-black">{g.targetScore.toFixed(1)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : <span className="text-slate-300 italic text-sm">Duy trì Tốt</span>}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right no-print">
                            <button 
                              onClick={() => setSelectedStudentForCard(s)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all font-black text-xs border border-indigo-100"
                            >
                              <Award className="w-4 h-4" />
                              Thẻ Mục Tiêu
                            </button>
                          </td>
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
    </div>
  );
};

export default App;
