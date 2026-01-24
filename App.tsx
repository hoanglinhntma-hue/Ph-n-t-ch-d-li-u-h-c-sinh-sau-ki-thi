
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  Upload, 
  FileText, 
  Download, 
  AlertCircle, 
  TrendingUp, 
  Target, 
  Users, 
  ChevronRight,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart3,
  Award,
  Grid,
  Filter,
  Layers,
  LayoutDashboard,
  Trash2,
  School,
  FileSpreadsheet,
  Image as ImageIcon,
  FileDown
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
  const [error, setError] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassification, setSelectedClassification] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<string>("SUMMARY"); 

  const reportRef = useRef<HTMLDivElement>(null);

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
        dat: students.filter(s => s.classification === StudentClassification.DAT).length,
        nguyCo: students.filter(s => s.classification === StudentClassification.NGUY_CO).length,
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
      datCount: list.filter(s => s.classification === StudentClassification.DAT).length,
      nguyCoCount: list.filter(s => s.classification === StudentClassification.NGUY_CO).length,
    };
  }, [currentViewStudents]);

  const sortedSubjectAverages = useMemo(() => {
    if (activeTab === "SUMMARY") return [];
    return headers.map(h => {
      const scores = currentViewStudents.map(s => s.scores.find(sc => sc.name === h)?.score).filter((v): v is number => v !== undefined && v >= 0);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { name: h, avg };
    }).sort((a, b) => a.avg - b.avg);
  }, [headers, currentViewStudents, activeTab]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
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
          const nameKey = allHeaders.find(h => {
            const l = h.trim().toLowerCase();
            return ['họ tên', 'họ và tên', 'tên', 'name'].includes(l) || (l.includes('họ') && l.includes('tên'));
          }) || 'Họ tên';
          
          const classKey = allHeaders.find(h => {
            const l = h.trim().toLowerCase();
            return ['lớp', 'class'].includes(l) || l.includes('lớp');
          }) || 'Lớp';
          
          const sttKey = allHeaders.find(h => ['stt', 'id', 'no'].includes(h.trim().toLowerCase())) || 'STT';

          const subjectHeaders = allHeaders.filter(h => ![sttKey, nameKey, classKey].includes(h));
          subjectHeaders.forEach(h => newSubjectHeaders.add(h));

          const processed = jsonData.map(item => {
            if (!item[classKey]) item[classKey] = wsname;
            return processRawStudentData(item, subjectHeaders, { nameKey, classKey, sttKey });
          }).filter((s): s is StudentData => s !== null);

          newProcessedStudents = [...newProcessedStudents, ...processed];
        });

        if (newProcessedStudents.length === 0) throw new Error("Không tìm thấy dữ liệu hợp lệ.");

        setHeaders(prev => Array.from(new Set([...prev, ...Array.from(newSubjectHeaders)])));
        setAllStudents(prev => [...prev, ...newProcessedStudents]);
        const uniqueNewClasses = Array.from(new Set(newProcessedStudents.map(s => s.className)));
        if (uniqueNewClasses.length === 1) setActiveTab(uniqueNewClasses[0]);
      } catch (err: any) {
        setError(err.message || "Lỗi khi xử lý file Excel.");
      } finally {
        setLoading(false);
        e.target.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadAiAdvice = async () => {
    if (currentViewStudents.length === 0) return;
    const key = activeTab;
    setAiAdvice(prev => ({ ...prev, [key]: "Đang phân tích..." }));
    const advice = await getPedagogicalAdvice(stats, currentViewStudents);
    setAiAdvice(prev => ({ ...prev, [key]: advice }));
  };

  const clearAllData = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ dữ liệu hiện có?")) {
      setAllStudents([]);
      setHeaders([]);
      setAiAdvice({});
      setActiveTab("SUMMARY");
    }
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    if (activeTab === "SUMMARY") {
      const statsData = schoolDetailedStats.map(s => ({
        'Tên lớp': s.className,
        'Tổng số HS': s.total,
        'Học sinh Tốt': s.tot,
        'Tiệm cận Tốt': s.tiemCanTot,
        'Học sinh Khá': s.kha,
        'Học sinh Đạt': s.dat,
        'Nguy cơ': s.nguyCo
      }));
      const wsStats = XLSX.utils.json_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, wsStats, "Thống kê các lớp");

      const priorityOrder = [
        StudentClassification.TOT,
        StudentClassification.TIEM_CAN_TOT,
        StudentClassification.NGUY_CO
      ];

      const filteredAndSorted = allStudents
        .filter(s => priorityOrder.includes(s.classification))
        .sort((a, b) => {
          return priorityOrder.indexOf(a.classification) - priorityOrder.indexOf(b.classification);
        });

      const summaryData = filteredAndSorted.map((s, index) => ({
        'STT': index + 1,
        'Họ tên': s.name,
        'Lớp': s.className,
        'Xếp loại': s.classification,
        'Khuyến nghị sư phạm': s.goals.length > 0 
          ? s.goals.map(g => `${g.subjectName} (${g.currentScore} -> ${g.targetScore.toFixed(1)})`).join('; ')
          : (s.classification === StudentClassification.TOT ? "Duy trì phong độ Tốt." : s.summary)
      }));

      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Danh sách trọng điểm");

      XLSX.writeFile(wb, "Bao_cao_trong_diem_toan_Truong.xlsx");
    } else {
      const studentsInClass = classGroups[activeTab] || [];
      const classData = studentsInClass.map(s => {
        const base: any = {
          'STT': s.id,
          'Họ tên': s.name,
          'Xếp loại': s.classification,
          'Khuyến nghị sư phạm': s.goals.length > 0 
            ? s.goals.map(g => `${g.subjectName}: ${g.currentScore} -> ${g.targetScore.toFixed(1)}`).join('; ')
            : s.summary
        };
        s.scores.forEach(sc => {
          base[sc.name] = sc.score;
        });
        return base;
      });
      const wsClass = XLSX.utils.json_to_sheet(classData);
      XLSX.utils.book_append_sheet(wb, wsClass, `Ket_qua_lop_${activeTab}`);

      const goalsData = studentsInClass.flatMap(s => s.goals.map(g => ({
        'Học sinh': s.name,
        'Môn học': g.subjectName,
        'Điểm hiện tại': g.currentScore,
        'Điểm mục tiêu': g.targetScore,
        'Cần tăng': g.increment.toFixed(1),
        'Lộ trình': g.description
      })));
      const wsGoals = XLSX.utils.json_to_sheet(goalsData);
      XLSX.utils.book_append_sheet(wb, wsGoals, "Muc_tieu_tien_bo");

      XLSX.writeFile(wb, `Ket_qua_lop_${activeTab.replace(/\s/g, '_')}.xlsx`);
    }
  };

  const exportAsImage = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Bao_cao_${activeTab}_EduMind.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Lỗi xuất ảnh:", err);
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Bao_cao_${activeTab}_EduMind.pdf`);
    } catch (err) {
      console.error("Lỗi xuất PDF:", err);
    } finally {
      setExporting(false);
    }
  };

  const chartData = [
    { name: 'Tốt', value: stats.totCount, fill: '#10b981' },
    { name: 'Tiệm cận Tốt', value: stats.tiemCanTotCount, fill: '#3b82f6' },
    { name: 'Khá', value: stats.khaCount, fill: '#6366f1' },
    { name: 'Đạt', value: stats.datCount, fill: '#eab308' },
    { name: 'Nguy cơ', value: stats.nguyCoCount, fill: '#f43f5e' },
  ];

  const getClassificationStyles = (cls: StudentClassification) => {
    switch (cls) {
      case StudentClassification.TOT: return 'bg-emerald-500 text-white border-emerald-400';
      case StudentClassification.TIEM_CAN_TOT: return 'bg-blue-500 text-white border-blue-400';
      case StudentClassification.KHA: return 'bg-indigo-500 text-white border-indigo-400';
      case StudentClassification.DAT: return 'bg-amber-500 text-white border-amber-400';
      case StudentClassification.NGUY_CO: return 'bg-rose-500 text-white border-rose-400';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Styles cho báo cáo sư phạm
  const reportStyle: React.CSSProperties = {
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: "14pt"
  };

  // Styles cho hồ sơ năng lực (16pt)
  const profileSectionStyle: React.CSSProperties = {
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: "16pt"
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" translate="no">
      <header className="bg-white border-b sticky top-0 z-50 no-print">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">EduMind <span className="text-indigo-600">Enterprise</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Quản lý Chất lượng Giáo dục TT22</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {allStudents.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border">
                <button 
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold"
                  title="Xuất Excel"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span className="hidden xl:inline">Excel</span>
                </button>
                <button 
                  onClick={exportAsImage}
                  disabled={exporting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold disabled:opacity-50"
                  title="Xuất Ảnh PNG"
                >
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <span className="hidden xl:inline">Ảnh</span>
                </button>
                <button 
                  onClick={exportAsPDF}
                  disabled={exporting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold disabled:opacity-50"
                  title="Xuất PDF"
                >
                  <FileDown className="w-4 h-4 text-rose-600" />
                  <span className="hidden xl:inline">PDF</span>
                </button>
              </div>
            )}
            
            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

            <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 text-sm font-bold shrink-0">
              <Upload className="w-4 h-4" /> 
              <span className="hidden sm:inline">Thêm dữ liệu</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
            
            {allStudents.length > 0 && (
              <button 
                onClick={clearAllData}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1600px] mx-auto w-full">
        <aside className="w-64 border-r bg-white hidden lg:flex flex-col p-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto no-print">
          <div className="mb-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Bảng điều khiển</h3>
            <button
              onClick={() => setActiveTab("SUMMARY")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
                activeTab === "SUMMARY" 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Tổng hợp trường
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cơ cấu lớp học ({sortedClassNames.length})</h3>
            </div>
            <div className="space-y-1">
              {sortedClassNames.map(cls => (
                <button
                  key={cls}
                  onClick={() => setActiveTab(cls)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all text-sm font-bold ${
                    activeTab === cls 
                    ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' 
                    : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{cls}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeTab === cls ? 'bg-indigo-200/50' : 'bg-slate-100'}`}>
                    {classGroups[cls].length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-hidden">
          {exporting && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
              <div className="bg-white p-8 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-black text-slate-900">Đang khởi tạo báo cáo chất lượng cao...</p>
                <p className="text-xs text-slate-400">Vui lòng chờ trong giây lát</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3 animate-pulse">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold text-indigo-700">Đang đồng bộ hóa dữ liệu...</p>
            </div>
          )}

          {allStudents.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <School className="w-12 h-12 text-slate-200" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Trung tâm Phân tích Dữ liệu EduMind</h2>
              <p className="text-slate-400 text-sm max-w-md mb-8">
                Hệ thống hỗ trợ xuất báo cáo chi tiết, hình ảnh minh họa và PDF chuyên nghiệp cho từng lớp học.
              </p>
              <label className="cursor-pointer px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition shadow-xl shadow-indigo-100">
                Bắt đầu bằng việc tải file Excel
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
              </label>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500 pedagogical-report" ref={reportRef} style={reportStyle}>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 mb-1">
                    {activeTab === "SUMMARY" ? <School className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                      {activeTab === "SUMMARY" ? "Mô-đun Tổng quát" : `Chi tiết Lớp ${activeTab}`}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                    {activeTab === "SUMMARY" ? "Tổng hợp chất lượng trường" : `Phân tích dữ liệu ${activeTab}`}
                  </h2>
                </div>
                
                <div className="flex gap-2">
                   <StatCardMini label="Tổng HS" value={stats.total} />
                   <StatCardMini label="Tốt" value={stats.totCount} color="text-emerald-600" />
                   <StatCardMini label="Nguy cơ" value={stats.nguyCoCount} color="text-rose-600" />
                </div>
              </div>

              {/* Stats Overview Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" /> Phân bổ học lực
                    </h3>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.filter(d => d.value > 0)}>
                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{fill: '#f8fafc'}} 
                          contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} 
                        />
                        <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={45}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-xl relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-amber-300" />
                        <h3 className="font-bold text-lg">Cố vấn sư phạm AI</h3>
                      </div>
                      {aiAdvice[activeTab] ? (
                        <div className="text-xs leading-relaxed text-slate-300 whitespace-pre-line bg-white/5 p-4 rounded-2xl border border-white/10 italic">
                          {aiAdvice[activeTab]}
                        </div>
                      ) : (
                        <div className="text-center py-4 no-print">
                          <p className="text-[11px] text-slate-400 mb-6">Phân tích chuyên sâu cho {activeTab === "SUMMARY" ? "toàn trường" : `lớp ${activeTab}`}.</p>
                          <button 
                            onClick={loadAiAdvice}
                            className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black hover:bg-indigo-500 transition shadow-lg"
                          >
                            Tạo gợi ý sư phạm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {activeTab !== "SUMMARY" && (
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Kết quả môn học (Trung bình - Sắp xếp thấp đến cao)</h4>
                      <div className="space-y-3">
                        {sortedSubjectAverages.map(item => (
                          <div key={item.name} className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 truncate mr-2">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{width: `${item.avg * 10}%`}} />
                              </div>
                              <span className="text-[10px] font-black text-slate-900 w-6 text-right">{item.avg.toFixed(1)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {activeTab === "SUMMARY" && (
                <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4">
                  <div className="p-8 border-b flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-500" /> Bảng thống kê chi tiết các lớp
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">Dữ liệu tổng hợp từ {sortedClassNames.length} mô-đun lớp học.</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                          <th className="px-8 py-5">Tên lớp</th>
                          <th className="px-8 py-5 text-center">Tổng HS</th>
                          <th className="px-8 py-5 text-center text-emerald-600">Tốt</th>
                          <th className="px-8 py-5 text-center text-blue-600">Tiệm cận Tốt</th>
                          <th className="px-8 py-5 text-center text-indigo-600">Khá</th>
                          <th className="px-8 py-5 text-center text-amber-600">Đạt</th>
                          <th className="px-8 py-5 text-center text-rose-600">Nguy cơ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {schoolDetailedStats.map(s => (
                          <tr key={s.className} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-8 py-5 font-black text-slate-900">{s.className}</td>
                            <td className="px-8 py-5 text-center font-bold">{s.total}</td>
                            <td className="px-8 py-5 text-center font-black text-emerald-600">{s.tot}</td>
                            <td className="px-8 py-5 text-center font-black text-blue-600">{s.tiemCanTot}</td>
                            <td className="px-8 py-5 text-center font-black text-indigo-600">{s.kha}</td>
                            <td className="px-8 py-5 text-center font-black text-amber-600">{s.dat}</td>
                            <td className="px-8 py-5 text-center font-black text-rose-600">{s.nguyCo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Student Database List - Hồ sơ năng lực (16pt font) */}
              <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden" style={profileSectionStyle}>
                <div className="p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-1">Hồ sơ năng lực học tập</h3>
                    <p className="text-xs text-slate-400 font-medium">Danh sách hiển thị: {filteredStudents.length} học sinh</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 no-print">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="Tìm học sinh..." 
                        className="pl-11 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <select 
                      className="px-6 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm"
                      value={selectedClassification}
                      onChange={(e) => setSelectedClassification(e.target.value)}
                    >
                      <option value="All">Tất cả xếp loại</option>
                      {Object.values(StudentClassification).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                        <th className="px-8 py-5">Định danh học sinh</th>
                        <th className="px-8 py-5">Kết quả TT22</th>
                        <th className="px-8 py-5">Trọng tâm tiến bộ</th>
                        <th className="px-8 py-5">Khuyến nghị sư phạm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredStudents.length > 0 ? filteredStudents.map(s => (
                        <tr key={`${s.className}-${s.id}-${s.name}`} className="group hover:bg-indigo-50/20 transition-colors">
                          <td className="px-8 py-6">
                            <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{s.name}</div>
                            <div className="text-[10px] font-black text-indigo-500 bg-indigo-50 w-fit px-1.5 py-0.5 rounded uppercase mt-1">{s.className}</div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-xl text-[12px] font-black border shadow-sm ${getClassificationStyles(s.classification)}`}>
                              {s.classification}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            {s.goals.length > 0 ? s.goals.slice(0, 1).map(g => (
                              <div key={g.subjectName} className="flex items-center gap-2">
                                <span className="font-black text-slate-700">{g.subjectName}</span>
                                <ChevronRight className="w-3 h-3 text-indigo-400" />
                                <span className="text-indigo-600 font-black">{g.targetScore.toFixed(1)}</span>
                              </div>
                            )) : (
                              <span className="text-slate-400 font-bold uppercase italic opacity-60">Duy trì</span>
                            )}
                          </td>
                          <td className="px-8 py-6">
                            <div className="max-w-xs space-y-2">
                              {s.goals.length > 0 ? (
                                s.goals.map((g, idx) => (
                                  <div key={idx} className="font-medium leading-tight text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 group-hover:bg-white transition-colors">
                                    <span className="font-black text-indigo-600 uppercase">{g.subjectName}:</span> {g.currentScore} <ChevronRight className="w-3 h-3 inline mx-1" /> <span className="font-black text-emerald-600">{g.targetScore.toFixed(1)}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-slate-500 font-medium italic">{s.classification === StudentClassification.TOT ? "Duy trì phong độ Tốt." : s.summary}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="px-8 py-20 text-center">
                            <p className="text-slate-400 font-medium">Chưa tìm thấy dữ liệu phù hợp.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <footer className="py-8 text-center border-t border-slate-100 hidden print-only:block">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Báo cáo được khởi tạo tự động bởi Hệ thống EduMind Enterprise - {new Date().toLocaleDateString('vi-VN')}
                </p>
              </footer>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const StatCardMini: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color = "text-slate-900" }) => (
  <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[110px] shadow-sm">
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{label}</span>
    <span className={`text-lg font-black ${color}`}>{value}</span>
  </div>
);

export default App;
