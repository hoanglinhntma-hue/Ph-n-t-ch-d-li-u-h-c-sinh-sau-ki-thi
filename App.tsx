
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
  TrendingUp,
  BookOpen,
  SlidersHorizontal,
  RefreshCcw,
  ArrowRight,
  ArrowLeft,
  FileText,
  Loader2,
  BrainCircuit,
  UserCheck,
  Lightbulb,
  AlertCircle,
  AlertTriangle,
  WifiOff,
  Cpu,
  User,
  HelpCircle,
  UserPlus,
  Users,
  Copy,
  Check,
  PenTool
} from 'lucide-react';
import { StudentData, ClassStats, StudentClassification, SubjectScore } from './types';
import { 
  processRawStudentData, 
  calculateClassificationAndGoals, 
  getSubjectLevel, 
  getRadarData,
  getAcademicLevel,
  getCombinedComments,
  getShortHocBaComment,
  PHAM_CHAT_LIST,
  NANG_LUC_LIST
} from './gradingService';
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
  PolarRadiusAxis,
  PieChart,
  Pie,
  Legend
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

// Chuẩn hóa tên lớp học để có thể matching chép (ví dụ: "10A1", "Lớp 10A1", "Lop 10A1", "10 A1")
const cleanClassName = (name: string): string => {
  return name.trim().toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^LỚP|^LOP/gi, '')
    .trim();
};

const getStudentsForClass = (clsName: string, studentsList: StudentData[]): StudentData[] => {
  const target = cleanClassName(clsName);
  return studentsList.filter(s => {
    const sClass = s.className || "";
    return cleanClassName(sClass) === target;
  });
};

const isSameSubject = (s1: string, s2: string): boolean => {
  const norm = (s: string) => {
    return s.trim().toLowerCase()
      .replace(/\s+/g, '')
      .replace(/học$/gi, '') // "sinh học" -> "sinh"
      .replace(/^môn/gi, ''); // "môn toán" -> "toán"
  };
  
  const n1 = norm(s1);
  const n2 = norm(s2);
  
  if (n1 === n2) return true;
  
  const aliases = [
    ['văn', 'ngữ văn', 'ngu van', 'n.văn', 'nvan'],
    ['anh', 'tiếng anh', 'tieng anh', 't.anh', 'n.ngữ', 'ngon ngu', 'ngoai ngu', 'ngoại ngữ'],
    ['lý', 'ly', 'vật lý', 'vat ly', 'lí', 'li', 'vật lí', 'v.lý', 'v.ly'],
    ['hóa', 'hoa', 'hoá'],
    ['địa', 'dia', 'địa lý', 'dia ly', 'địa lí', 'đ.lý', 'đ.ly'],
    ['gdcd', 'công dân', 'cong dan', 'kinh tế pháp luật', 'gdkt', 'ktpl', 'pl', 'gdkt&pl', 'gdkt & pl'],
    ['gdtc', 'thể dục', 'the duc', 'thể chất', 'giáo dục thể chất'],
    ['gdqp', 'gdqp&an', 'quốc phòng', 'gdqp-an', 'quốc phòng an ninh', 'qp&an'],
    ['hđtn', 'hdtn', 'hđtn&hn', 'hoạt động trải nghiệm', 'trải nghiệm'],
    ['công nghệ', 'cong nghe', 'c.nghệ', 'c.nghe', 'cn', 'c. nghệ', 'c công nghệ', 'cc nghệ'],
    ['tin học', 'tin hoc', 'tin', 'tin.học', 'tinhọc']
  ];
  
  for (const list of aliases) {
    if (list.includes(n1) && list.includes(n2)) return true;
    if (list.some(item => norm(item) === n1) && list.some(item => norm(item) === n2)) return true;
  }
  
  return false;
};

const getSubjectGroup = (subjName: string): 1 | 2 | 3 | 4 => {
  const norm = (s: string) => {
    return s.trim().toLowerCase()
      .replace(/\s+/g, '')
      .replace(/học$/gi, '')
      .replace(/^môn/gi, '');
  };

  const n = norm(subjName);

  // Group 1: Ngoại ngữ, Sinh học, Lịch sử
  const g1 = [
    'anh', 'tiếnganh', 'tienganh', 't.anh', 'n.ngữ', 'ngonngu', 'ngoạingữ', 'ngoai ngu', 'ngoại ngữ', 'nướcngoài',
    'sinh', 'sinhhọc', 'sinh hoc',
    'sử', 'lịchsử', 'lichsu', 'lich sử'
  ].map(norm);

  // Group 2: Ngữ văn, Địa lí, Vật lí, Hóa học, Toán học
  const g2 = [
    'văn', 'ngữvăn', 'nguvan', 'n.văn', 'nvan',
    'địa', 'địalí', 'địalý', 'dialy', 'diali',
    'lý', 'vậtlý', 'vatly', 'lí', 'vậtlí', 'vatli',
    'hóa', 'hoá', 'hóahọc', 'hoahoc',
    'toán', 'toánhọc', 'toanhoc'
  ].map(norm);

  // Group 3: Tin học, Giáo dục Kinh tế & Pháp luật
  const g3 = [
    'tin', 'tinhọc', 'tinhoc',
    'gdcd', 'côngdân', 'congdan', 'kinhtếphápluật', 'gdkt', 'ktpl', 'pl', 'gdkt&pl', 'gdkt & pl', 'phápluật'
  ].map(norm);

  // Group 4: Công nghệ, Giáo dục Quốc phòng & An ninh
  const g4 = [
    'côngnghệ', 'congnghe',
    'gdqp', 'gdqp&an', 'quốcphòng', 'gdqp-an', 'quốcphònganninh', 'qp&an', 'quocphong',
    'gdtc', 'thểdục', 'theduc', 'thểchất', 'giáodụcthểchất',
    'hđtn', 'hdtn', 'hđtn&hn', 'hoạtđộngtrảinghiệm', 'trảinghiệm'
  ].map(norm);

  if (g1.includes(n)) return 1;
  if (g2.includes(n)) return 2;
  if (g3.includes(n)) return 3;
  if (g4.includes(n)) return 4;

  // Let's do partial checks if not found exactly
  if (['anh', 'english', 'sinh', 'sử', 'su'].some(x => n.includes(x))) return 1;
  if (['văn', 'địa', 'lý', 'lí', 'hóa', 'hoa', 'toán', 'toan'].some(x => n.includes(x))) return 2;
  if (['tin', 'ktpl', 'pl', 'gdcd', 'dan'].some(x => n.includes(x))) return 3;
  if (['công', 'nghệ', 'qp', 'quốcphòng', 'thểdục', 'gdtc', 'trải', 'hđtn'].some(x => n.includes(x))) return 4;

  // Default fallback (Cơ bản)
  return 2;
};

const App: React.FC = () => {
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassification, setSelectedClassification] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<string>("SUMMARY"); 
  const [summaryViewMode, setSummaryViewMode] = useState<'OVERVIEW' | 'CLASS_WISE' | 'SUBJECT_WISE' | 'TEACHER_WISE'>('OVERVIEW');
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<StudentData | null>(null);
  const [commentingStudent, setCommentingStudent] = useState<StudentData | null>(null);
  const [commentTab, setCommentTab] = useState<'COMBINED' | 'SHORT' | 'TRAITS'>('COMBINED');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  const [fontSizeScale, setFontSizeScale] = useState<'normal' | 'large' | 'xlarge' | 'huge'>(() => {
    try {
      const saved = localStorage.getItem("grading_app_font_scale");
      return (saved as any) || "normal";
    } catch {
      return "normal";
    }
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("grading_app_high_contrast");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const [presentationTheme, setPresentationTheme] = useState<'green-mint' | 'orange-pastel' | 'blue-sky' | 'default'>(() => {
    try {
      const saved = localStorage.getItem("grading_app_pres_theme");
      // Default to 'green-mint' as requested by user first, very modern and elegant!
      return (saved as any) || "green-mint";
    } catch {
      return "green-mint";
    }
  });

  useEffect(() => {
    localStorage.setItem("grading_app_font_scale", fontSizeScale);
  }, [fontSizeScale]);

  useEffect(() => {
    localStorage.setItem("grading_app_high_contrast", String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem("grading_app_pres_theme", presentationTheme);
  }, [presentationTheme]);
  
  const [customSubjectTargets, setCustomSubjectTargets] = useState<Record<string, {
    htxsnvRate: number;
    httRate: number;
    htnvRate: number;
    passRateReq: number;
  }>>(() => {
    try {
      const saved = localStorage.getItem("grading_app_subject_targets");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("grading_app_subject_targets", JSON.stringify(customSubjectTargets));
  }, [customSubjectTargets]);

  const getTargetForSubject = (subjName: string) => {
    if (customSubjectTargets && customSubjectTargets[subjName]) {
      return customSubjectTargets[subjName];
    }
    const matchedKey = Object.keys(customSubjectTargets || {}).find(k => isSameSubject(k, subjName));
    if (matchedKey) {
      return customSubjectTargets[matchedKey];
    }
    const groupNum = getSubjectGroup(subjName);
    if (groupNum === 1) {
      return { htxsnvRate: 65, httRate: 55, htnvRate: 45, passRateReq: 100 };
    } else if (groupNum === 2) {
      return { htxsnvRate: 80, httRate: 70, htnvRate: 55, passRateReq: 100 };
    } else if (groupNum === 3) {
      return { htxsnvRate: 85, httRate: 75, htnvRate: 65, passRateReq: 100 };
    } else {
      return { htxsnvRate: 92, httRate: 85, htnvRate: 75, passRateReq: 100 };
    }
  };

  const uniqueSubjectsInSystem: string[] = useMemo(() => {
    const subjectsSet = new Set<string>();
    allStudents.forEach(s => {
      if (s.scores) {
        s.scores.forEach(sc => {
          if (sc.name) {
            subjectsSet.add(sc.name);
          }
        });
      }
    });
    if (subjectsSet.size === 0) {
      const defaults = ["Toán học", "Ngữ văn", "Ngoại ngữ", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "Tin học", "Công nghệ", "Giáo dục Quốc phòng & An ninh", "Giáo dục Kinh tế & Pháp luật"];
      defaults.forEach(d => subjectsSet.add(d));
    }
    return Array.from(subjectsSet).sort();
  }, [allStudents]);

  const updateSubjectTarget = (subj: string, field: string, val: number) => {
    setCustomSubjectTargets(prev => {
      const base = getTargetForSubject(subj);
      return {
        ...prev,
        [subj]: {
          htxsnvRate: field === 'htxsnvRate' ? val : base.htxsnvRate,
          httRate: field === 'httRate' ? val : base.httRate,
          htnvRate: field === 'htnvRate' ? val : base.htnvRate,
          passRateReq: field === 'passRateReq' ? val : base.passRateReq
        }
      };
    });
  };

  const handleTargetsExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json<any>(ws);
        
        const newTargets = { ...customSubjectTargets };
        rows.forEach((row: any) => {
          const rawSubject = row["Môn học"] || row["Môn"] || row["Subject"] || row["môn học"] || row["môn"];
          if (!rawSubject) return;
          const subject = String(rawSubject).trim();
          
          const htxsnv = parseFloat(row["Xuất sắc"] || row["HTXSNV"] || row["Hoàn thành xuất sắc nhiệm vụ"] || row["Xuất sắc (%)"] || row["htxsnvRate"] || row["htxsnv"]);
          const htt = parseFloat(row["Tốt"] || row["HTT"] || row["Hoàn thành tốt nhiệm vụ"] || row["Tốt (%)"] || row["httRate"] || row["htt"]);
          const htnv = parseFloat(row["Nhiệm vụ"] || row["HTNV"] || row["Hoàn thành nhiệm vụ"] || row["Nhiệm vụ (%)"] || row["htnvRate"] || row["htnv"]);
          const pass = parseFloat(row["Đạt"] || row["Chỉ tiêu Đạt"] || row["Tỷ lệ Đạt"] || row["Pass"] || row["passRateReq"] || row["pass"]);
          
          newTargets[subject] = {
            htxsnvRate: isNaN(htxsnv) ? 80 : htxsnv,
            httRate: isNaN(htt) ? 70 : htt,
            htnvRate: isNaN(htnv) ? 55 : htnv,
            passRateReq: isNaN(pass) ? 100 : pass
          };
        });
        
        setCustomSubjectTargets(newTargets);
        alert("Tải lên chỉ tiêu theo môn thành công!");
      } catch (err) {
        console.error("Lỗi parse chỉ tiêu Excel:", err);
        alert("Có lỗi xảy ra khi đọc file Excel chỉ tiêu. Hãy kiểm tra lại cấu trúc.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportTargetsExcel = () => {
    const excelRows = uniqueSubjectsInSystem.map((subj: string) => {
      const t = getTargetForSubject(subj);
      return {
        "Môn học": subj,
        "Chỉ tiêu Đạt (%)": t.passRateReq,
        "Mức Khá/Tốt đạt loại Xuất sắc (HTXSNV) (%)": t.htxsnvRate,
        "Mức Khá/Tốt đạt loại Tốt (HTT) (%)": t.httRate,
        "Mức Khá/Tốt đạt loại Nhiệm vụ (HTNV) (%)": t.htnvRate,
      };
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(wb, ws, "Chi_Tieu_Bo_Mon");
    XLSX.writeFile(wb, "Chi_Tieu_Xep_Loai_Mon_Hoc.xlsx");
  };

  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [adviceSource, setAdviceSource] = useState<'AI' | 'Local' | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [simulatingStudent, setSimulatingStudent] = useState<StudentData | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [simulatedScores, setSimulatedScores] = useState<SubjectScore[]>([]);
  const [simulatedConduct, setSimulatedConduct] = useState<string>("Tốt");
  const [simulatedAbsences, setSimulatedAbsences] = useState<number>(0);

  const reportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const batchCardRef = useRef<HTMLDivElement>(null);
  const [batchTargetStudent, setBatchTargetStudent] = useState<StudentData | null>(null);

  const APP_NAME = "Trợ lý phân tích số liệu điểm thi";
  const APP_SUBTITLE = "Phân tích năng lực và quyết định sư phạm";

  const STORAGE_KEY = "grading_app_data_v2";
  const isInitialMount = useRef(true);

  // Load and Sync logic
  useEffect(() => {
    // 1. Initial Load
    if (isInitialMount.current) {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        try {
          const { students, headersList, teachers, subTeachers } = JSON.parse(savedData);
          if (students && Array.isArray(students)) {
            const migrated = students.map((s: any) => {
              const refreshed = calculateClassificationAndGoals(
                s.scores || [],
                s.conduct || "Tốt",
                s.absencesTotal || 0,
                s.absencesExcused || 0,
                s.absencesUnexcused || 0
              );
              
              let classification: any = refreshed.classification;
              if (
                classification === 'Tiệm cận ĐẠT' ||
                classification === 'Tiệm cận Đạt' ||
                classification === 'Tiệm cận đạt'
              ) {
                classification = StudentClassification.TIEM_CAN_DAT;
              } else if (
                classification === 'CHƯA ĐẠT' ||
                classification === 'Chưa đạt' ||
                classification === 'Chưa Đạt' ||
                classification === 'Học sinh CHƯA ĐẠT'
              ) {
                classification = StudentClassification.CHUA_DAT;
              }
              return { 
                ...s, 
                classification,
                goals: refreshed.goals,
                remedialSubjects: refreshed.remedialSubjects,
                merit: refreshed.merit,
                promotionStatus: refreshed.promotionStatus,
                alerts: refreshed.alerts,
                summary: refreshed.goals.length > 0 ? `Cần cải thiện ${refreshed.goals.length} môn.` : "Ổn định.",
                prioritySubjects: refreshed.goals.map(g => g.subjectName)
              };
            });
            setAllStudents(migrated);
          }
          if (headersList) setHeaders(headersList);
          if (teachers) setTeacherNames(teachers);
          if (subTeachers) setSubjectTeachers(subTeachers);
        } catch (err) {
          console.error("Lỗi khôi phục:", err);
        }
      }
      isInitialMount.current = false;
      return;
    }

    // 2. Sync to LocalStorage
    if (allStudents.length > 0 || Object.keys(teacherNames).length > 0 || Object.keys(subjectTeachers).length > 0) {
      const dataToSave = {
        students: allStudents,
        headersList: headers,
        teachers: teacherNames,
        subTeachers: subjectTeachers
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } else {
      // Clear if empty
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [allStudents, headers, teacherNames, subjectTeachers]);

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

  const conductStats = useMemo(() => {
    let totCount = 0;
    let khaCount = 0;
    let datCount = 0;
    let chuaDatCount = 0;
    
    currentViewStudents.forEach(s => {
      const cond = s.conduct ? s.conduct.trim() : "Tốt";
      if (cond === "Chưa đạt") chuaDatCount++;
      else if (cond === "Khá") khaCount++;
      else if (cond === "Đạt") datCount++;
      else totCount++; // Default/Tốt
    });
    
    return [
      { name: "Tốt", value: totCount, fill: "#10b981" },
      { name: "Khá", value: khaCount, fill: "#f59e0b" },
      { name: "Đạt", value: datCount, fill: "#3b82f6" },
      { name: "Chưa đạt", value: chuaDatCount, fill: "#ef4444" }
    ];
  }, [currentViewStudents]);

  const flaggedStudents = useMemo(() => {
    return currentViewStudents.filter(s => {
      const excused = s.absencesExcused || 0;
      const unexcused = s.absencesUnexcused || 0;
      const conduct = s.conduct || 'Tốt';
      const isAttendanceFlagged = excused > 30 || unexcused >= 1;
      const isConductFlagged = conduct === 'Chưa đạt';
      return isAttendanceFlagged || isConductFlagged;
    });
  }, [currentViewStudents]);

  const schoolDetailedStats = useMemo(() => {
    const list = sortedClassNames.map(cls => {
      const students = classGroups[cls] || [];
      const total = students.length;

      const totCount = students.filter(s => s.classification === StudentClassification.TOT).length;
      const tiemCanTotCount = students.filter(s => s.classification === StudentClassification.TIEM_CAN_TOT).length;
      const khaCount = students.filter(s => s.classification === StudentClassification.KHA).length;
      const tiemCanKhaCount = students.filter(s => s.classification === StudentClassification.TIEM_CAN_KHA).length;
      const datCount = students.filter(s => s.classification === StudentClassification.DAT).length;
      const tiemCanDatCount = students.filter(s => s.classification === StudentClassification.TIEM_CAN_DAT).length; // Nguy cơ
      const chuaDatCount = students.filter(s => s.classification === StudentClassification.CHUA_DAT).length; // Nguy hiểm

      // Calculate class average GPA
      let classTotalScoreSum = 0;
      let classScoreCount = 0;
      students.forEach(st => {
        st.scores.forEach(ob => {
          if (ob.score >= 0) {
            classTotalScoreSum += ob.score;
            classScoreCount++;
          }
        });
      });
      const avgClassScore = classScoreCount > 0 ? (classTotalScoreSum / classScoreCount) : 0;

      // Calculate promotion rate
      const promotedCount = students.filter(s => s.promotionStatus && s.promotionStatus.includes('Được lên lớp')).length;
      const promotionRate = total > 0 ? (promotedCount / total) * 100 : 0;

      // Rate of Good & Fair (Khá & Giỏi/Tốt)
      const goodAndFairCount = totCount + tiemCanTotCount + khaCount + tiemCanKhaCount;
      const goodAndFairRate = total > 0 ? (goodAndFairCount / total) * 100 : 0;

      return {
        className: cls,
        total,
        totCount,
        tiemCanTotCount,
        khaCount,
        tiemCanKhaCount,
        datCount,
        tiemCanDatCount, // Nguy cơ
        chuaDatCount, // Nguy hiểm
        avgClassScore,
        promotionRate,
        goodAndFairRate
      };
    });

    // Sort by rate of Good & Fair students descending, then by average GPA descending
    return list.sort((a, b) => {
      if (b.goodAndFairRate !== a.goodAndFairRate) {
        return b.goodAndFairRate - a.goodAndFairRate;
      }
      return b.avgClassScore - a.avgClassScore;
    });
  }, [classGroups, sortedClassNames]);

  const bestClass = useMemo(() => {
    if (schoolDetailedStats.length === 0) return null;
    return schoolDetailedStats[0];
  }, [schoolDetailedStats]);

  const targetClassToFocus = useMemo(() => {
    if (schoolDetailedStats.length <= 1) return null;
    
    // Filter out best class by name (case-insensitive and trimmed)
    const bestClassNameUpper = bestClass?.className.trim().toUpperCase() || '';
    const candidates = schoolDetailedStats.filter(s => s.className.trim().toUpperCase() !== bestClassNameUpper);
    
    if (candidates.length === 0) return null;

    // From candidates, find the one with the highest concentration of of concern (Nguy cơ/Nguy hiểm)
    const sorted = [...candidates].sort((a, b) => {
      const aRisk = a.total > 0 ? (a.tiemCanDatCount + a.chuaDatCount) / a.total : 0;
      const bRisk = b.total > 0 ? (b.tiemCanDatCount + b.chuaDatCount) / b.total : 0;
      if (bRisk !== aRisk) return bRisk - aRisk; // Higher risk first
      
      return a.avgClassScore - b.avgClassScore; // Lower GPA first
    });
    return sorted[0];
  }, [schoolDetailedStats, bestClass]);

  const subjectDetailedStats = useMemo(() => {
    return headers.map(subjectName => {
      // Find all scores of all students in currentViewStudents for this subjectName
      const scores = currentViewStudents
        .map(s => s.scores.find(sc => sc.name === subjectName)?.score)
        .filter((sc): sc is number => sc !== undefined && sc >= 0);

      const totalGrades = scores.length;
      const totCount = scores.filter(sc => sc >= 8.0).length;
      const khaCount = scores.filter(sc => sc >= 6.5 && sc < 8.0).length;
      const datCount = scores.filter(sc => sc >= 5.0 && sc < 6.5).length;
      const chuaDatCount = scores.filter(sc => sc < 5.0).length;

      const sum = scores.reduce((acc, val) => acc + val, 0);
      const average = totalGrades > 0 ? sum / totalGrades : 0;

      return {
        subjectName,
        total: totalGrades,
        totCount,
        khaCount,
        datCount,
        chuaDatCount,
        average
      };
    }).sort((a, b) => b.average - a.average); // Sort by average grade descending
  }, [headers, currentViewStudents]);

  const teacherPerformanceStats = useMemo(() => {
    const teachersMap: Record<string, {
      name: string;
      gvcnClasses: string[];
      subjectClasses: Array<{ className: string, subjectName: string }>;
    }> = {};

    const registerTeacher = (rawName: string) => {
      const name = rawName.trim();
      if (!name) return null;
      const key = name.toLowerCase();
      if (!teachersMap[key]) {
        teachersMap[key] = {
          name,
          gvcnClasses: [],
          subjectClasses: []
        };
      }
      return teachersMap[key];
    };

    // 1. Scan GVCN classes
    Object.entries(teacherNames).forEach(([cls, name]) => {
      const t = registerTeacher(name);
      if (t && !t.gvcnClasses.includes(cls)) {
        t.gvcnClasses.push(cls);
      }
    });

    // 2. Scan Subject teachers in each class
    Object.entries(subjectTeachers).forEach(([cls, subjects]) => {
      Object.entries(subjects).forEach(([subject, name]) => {
        const t = registerTeacher(name);
        if (t) {
          const standardSubject = headers.find(h => isSameSubject(h, subject)) || subject;
          const alreadyHas = t.subjectClasses.some(sc => 
            sc.className === cls && isSameSubject(sc.subjectName, standardSubject)
          );
          if (!alreadyHas) {
            t.subjectClasses.push({ className: cls, subjectName: standardSubject });
          }
        }
      });
    });

    // Compute metrics
    return Object.values(teachersMap).map(teacher => {
      // Metric for GVCN
      const gvcnMetrics = teacher.gvcnClasses.map(cls => {
        const students = getStudentsForClass(cls, allStudents);
        const total = students.length;
        if (total === 0) return null;

        const goodAndFairCount = students.filter(s => 
          s.classification === StudentClassification.TOT || 
          s.classification === StudentClassification.TIEM_CAN_TOT || 
          s.classification === StudentClassification.KHA || 
          s.classification === StudentClassification.TIEM_CAN_KHA
        ).length;

        const riskCount = students.filter(s => 
          s.classification === StudentClassification.TIEM_CAN_DAT || 
          s.classification === StudentClassification.CHUA_DAT
        ).length;

        const sumGpa = students.reduce((sum, s) => {
          const studentAvg = s.scores.length > 0 ? (s.scores.reduce((acc, sc) => acc + sc.score, 0) / s.scores.length) : 0;
          return sum + studentAvg;
        }, 0);

        const passCount = students.filter(s => 
          s.classification !== StudentClassification.CHUA_DAT
        ).length;
        const passRate = total > 0 ? (passCount / total) * 100 : 0;
        const goodAndFairRate = total > 0 ? (goodAndFairCount / total) * 100 : 0;

        let principalRating = "Không hoàn thành nhiệm vụ (KHTNV)";
        if (passRate === 100) {
          if (goodAndFairRate > 70) {
            principalRating = "Hoàn thành xuất sắc nhiệm vụ (HTXSNV)";
          } else if (goodAndFairRate >= 60) {
            principalRating = "Hoàn thành tốt nhiệm vụ (HTT)";
          } else {
            principalRating = "Hoàn thành nhiệm vụ (HTNV)";
          }
        }

        return {
          className: cls,
          total,
          gpa: sumGpa / total,
          goodAndFairRate,
          riskRate: (riskCount / total) * 100,
          riskCount,
          passCount,
          passRate,
          principalRating
        };
      }).filter(Boolean) as Array<{ className: string, total: number, gpa: number, goodAndFairRate: number, riskRate: number, riskCount: number, passCount: number, passRate: number, principalRating: string }>;

      // Metric for Subject Teaching
      const subjectMetrics = teacher.subjectClasses.map(sc => {
        const students = getStudentsForClass(sc.className, allStudents);
        const total = students.length;
        if (total === 0) return null;

        const subjectScores = students.map(s => {
          const scoreObj = s.scores.find(score => isSameSubject(score.name, sc.subjectName));
          return scoreObj ? scoreObj.score : null;
        }).filter((v): v is number => v !== null && v >= 0);

        if (subjectScores.length === 0) return null;

        const subTotal = subjectScores.length;
        const subSum = subjectScores.reduce((sum, val) => sum + val, 0);
        const subGpa = subSum / subTotal;

        const goodAndFairCount = subjectScores.filter(v => v >= 6.5).length;
        const riskCount = subjectScores.filter(v => v < 5.0).length;

        const goodAndFairRate = subTotal > 0 ? (goodAndFairCount / subTotal) * 100 : 0;
        const passCount = subjectScores.filter(v => v >= 5.0).length;
        const passRate = subTotal > 0 ? (passCount / subTotal) * 100 : 0;

        const target = getTargetForSubject(sc.subjectName);
        let principalRating = "Không hoàn thành nhiệm vụ (KHTNV)";
        if (passRate >= target.passRateReq) {
          if (goodAndFairRate >= target.htxsnvRate) {
            principalRating = "Hoàn thành xuất sắc nhiệm vụ (HTXSNV)";
          } else if (goodAndFairRate >= target.httRate) {
            principalRating = "Hoàn thành tốt nhiệm vụ (HTT)";
          } else if (goodAndFairRate >= target.htnvRate) {
            principalRating = "Hoàn thành nhiệm vụ (HTNV)";
          }
        }

        return {
          className: sc.className,
          subjectName: sc.subjectName,
          total: subTotal,
          gpa: subGpa,
          goodAndFairRate,
          riskRate: (riskCount / subTotal) * 100,
          riskCount,
          passCount,
          passRate,
          principalRating
        };
      }).filter(Boolean) as Array<{ className: string, subjectName: string, total: number, gpa: number, goodAndFairRate: number, riskRate: number, riskCount: number, passCount: number, passRate: number, principalRating: string }>;

      // Calculate aggregated statistics for subject instruction
      let totalAssignedStudents = 0;
      let totalGpaPoints = 0;
      let totalGoodAndFairCount = 0;
      let totalRiskCount = 0;

      subjectMetrics.forEach(m => {
        totalAssignedStudents += m.total;
        totalGpaPoints += m.gpa * m.total;
        totalGoodAndFairCount += (m.goodAndFairRate / 100) * m.total;
        totalRiskCount += m.riskCount;
      });

      const overallSubjectGpa = totalAssignedStudents > 0 ? totalGpaPoints / totalAssignedStudents : 0;
      const overallSubjectGoodAndFairRate = totalAssignedStudents > 0 ? (totalGoodAndFairCount / totalAssignedStudents) * 100 : 0;
      const overallSubjectRiskRate = totalAssignedStudents > 0 ? (totalRiskCount / totalAssignedStudents) * 100 : 0;

      return {
        ...teacher,
        gvcnMetrics,
        subjectMetrics,
        overallSubjectGpa,
        overallSubjectGoodAndFairRate,
        overallSubjectRiskRate,
        totalAssignedStudents,
        totalRiskCount
      };
    });
  }, [teacherNames, subjectTeachers, allStudents]);

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
    if (simulatingStudent) {
      setSimulatedScores([...simulatingStudent.scores]);
      setSimulatedConduct(simulatingStudent.conduct || "Tốt");
      setSimulatedAbsences(simulatingStudent.absencesTotal || 0);
    }
  }, [simulatingStudent]);

  const simulationResult = useMemo(() => {
    if (!simulatingStudent || simulatedScores.length === 0) return null;
    return calculateClassificationAndGoals(simulatedScores, simulatedConduct, simulatedAbsences);
  }, [simulatingStudent, simulatedScores, simulatedConduct, simulatedAbsences]);

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

        const VietnamSubjectsKeywords = [
          'toán', 'toan', 'toán học', 'toan hoc',
          'văn', 'van', 'ngữ văn', 'ngu van', 'n.văn', 'n.van', 'ngữvăn',
          'anh', 'tiếng anh', 'tieng anh', 't.anh', 'ngoại ngữ', 'ngon ngu', 'ng.ngữ', 'ng.ngu', 'ngoai ngu', 'tiếng nước ngoài',
          'lý', 'ly', 'lí', 'li', 'vật lý', 'vat ly', 'vật lí', 'vat li', 'v.lý', 'v.ly', 'v.lí', 'v.li',
          'hóa', 'hoa', 'hoá', 'hóa học',
          'sinh', 'sinh học', 'sinh hoc', 'sinh vật', 'sinh vat',
          'sử', 'su', 'lịch sử', 'lich su', 'l.sử', 'l.su',
          'địa', 'dia', 'địa lý', 'dia ly', 'địa lí', 'dia li', 'đ.lý', 'đ.ly', 'đ.lí', 'đ.li',
          'gdcd', 'công dân', 'cong dan', 'gdkt&pl', 'gdkt', 'pl', 'ktpl', 'kt-pl', 'kinh tế pháp luật', 'kinh te phap luat', 'gdkt & pl',
          'tin', 'tin học', 'tin hoc', 'it', 'công nghệ thông tin',
          'công nghệ', 'cong nghe', 'c.nghệ', 'c.nghe', 'cn',
          'gdtc', 'thể dục', 'the duc', 'giáo dục thể chất', 'giao duc the chat', 'thể chất', 'the chat',
          'gdqp', 'gdqp&an', 'gdqp-an', 'quốc phòng', 'quoc phong', 'an ninh', 'quốc phòng an ninh', 'qp-an', 'qp&an', 'gdqp & an',
          'hđtn', 'hdtn', 'hđtn&hn', 'hdtn&hn', 'hoạt động trải nghiệm', 'hoat dong trai nghiem', 'hđtn & hn',
          'ndgdcđ', 'địa phương', 'dia phuong', 'gd địa phương', 'gd đp'
        ];

        const isAcademicSubject = (headerName: string): boolean => {
          const clean = headerName.trim().toLowerCase();
          
          if (clean === 'sinh' && (clean.includes('học sinh') || clean.includes('danh') || clean.includes('định'))) {
            return false;
          }
          if (clean.includes('mã học sinh') || clean.includes('định danh') || clean.includes('ngày sinh') || clean.includes('nơi sinh') || clean.includes('đăng ký')) {
            return false;
          }
          if (clean.includes('học tập') || clean.includes('rèn luyện') || clean.includes('buổi nghỉ') || clean.includes('bù') || clean.includes('vắng') || clean.includes('danh hiệu') || clean.includes('ghi chú')) {
            return false;
          }

          if (VietnamSubjectsKeywords.includes(clean)) {
            return true;
          }

          return VietnamSubjectsKeywords.some(kw => {
            if (kw.length >= 3 && clean.includes(kw)) {
              if (kw === 'sinh' && (clean.includes('học sinh') || clean.includes('định danh'))) {
                return false;
              }
              return true;
            }
            return false;
          });
        };

        wb.SheetNames.forEach(wsname => {
          const ws = wb.Sheets[wsname];
          const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
          if (rows.length === 0) return;

          let bestRowIndex = -1;
          let maxSubjectCount = 0;
          
          for (let i = 0; i < Math.min(rows.length, 30); i++) {
            const row = rows[i];
            if (!row || !Array.isArray(row)) continue;
            
            let subjectCount = 0;
            let hasNameField = false;
            
            row.forEach(cell => {
              const cellStr = String(cell || '').trim().toLowerCase();
              if (['họ tên', 'họ và tên', 'họ & tên', 'tên học sinh', 'tên'].includes(cellStr)) {
                hasNameField = true;
              }
              if (isAcademicSubject(cellStr)) {
                subjectCount++;
              }
            });

            if (hasNameField && subjectCount >= 3) {
              if (subjectCount > maxSubjectCount) {
                maxSubjectCount = subjectCount;
                bestRowIndex = i;
              }
            }
          }

          if (bestRowIndex === -1) {
            for (let i = 0; i < Math.min(rows.length, 30); i++) {
              const row = rows[i];
              if (!row || !Array.isArray(row)) continue;
              const rowStr = row.map(c => String(c || '').trim().toLowerCase());
              if (rowStr.some(str => ['họ tên', 'họ và tên', 'họ & tên', 'tên học sinh', 'tên'].includes(str))) {
                bestRowIndex = i;
                break;
              }
            }
          }

          if (bestRowIndex === -1) {
            bestRowIndex = 0;
          }

          const rawHeaderRow = rows[bestRowIndex];
          if (!rawHeaderRow || !Array.isArray(rawHeaderRow)) return;

          const headersList = rawHeaderRow.map((cell, idx) => {
            const str = String(cell || '').trim();
            return str !== '' ? str : `Col_${idx}`;
          });

          const nameKey = headersList.find(h => ['họ tên', 'họ và tên', 'họ & tên', 'tên học sinh', 'tên'].includes(h.trim().toLowerCase())) || headersList[3] || 'Họ và tên';
          const classKey = headersList.find(h => {
             const clean = h.trim().toLowerCase();
             return clean === 'lớp' || 
                    clean === 'lop' || 
                    clean === 'class' || 
                    clean === 'tên lớp' || 
                    clean === 'lớp học' || 
                    clean.includes('lớp') || 
                    clean.includes('lop');
          }) || 'Lớp';
          const sttKey = headersList.find(h => ['stt', 'id', 'số thứ tự'].includes(h.trim().toLowerCase())) || 'STT';

          // Detect specialized columns
          let conductColIdx = -1;
          let pIdx = -1;
          let kIdx = -1;
          let tongIdx = -1;
          let ghiChuColIdx = -1;

          // Search via elements in header row cells
          for (let c = 0; c < headersList.length; c++) {
            const val6 = String(rows[bestRowIndex]?.[c] || '').trim().toLowerCase();
            const val7 = String(rows[bestRowIndex + 1]?.[c] || '').trim().toLowerCase();

            if ((val6.includes('rèn luyện') || val7.includes('rèn luyện') || val6.includes('ren luyen') || val7.includes('ren luyen') || val6.includes('kqrl') || val7.includes('kqrl')) && 
                !val6.includes('sau hè') && !val7.includes('sau hè') && !val6.includes('sau he') && !val7.includes('sau he')) {
              conductColIdx = c;
            }
            if (val6.includes('ghi chú') || val7.includes('ghi chú') || val6.includes('ghi chu') || val7.includes('ghi chu')) {
              ghiChuColIdx = c;
            }
          }

          // Search consecutive P, K, Tổng pattern for attendance
          for (let c = 0; c < Math.min(headersList.length, 100); c++) {
            const r6_val = String(rows[bestRowIndex]?.[c] || '').trim().toLowerCase();
            const r7_val = String(rows[bestRowIndex + 1]?.[c] || '').trim().toLowerCase();
            
            const isP = r6_val === 'p' || r7_val === 'p' || r6_val === 'phép' || r7_val === 'phép' || r6_val === 'có phép' || r7_val === 'có phép';
            if (isP) {
              const next_r6 = String(rows[bestRowIndex]?.[c+1] || '').trim().toLowerCase();
              const next_r7 = String(rows[bestRowIndex + 1]?.[c+1] || '').trim().toLowerCase();
              const isK = next_r6 === 'k' || next_r7 === 'k' || next_r6 === 'không phép' || next_r7 === 'không phép' || next_r6 === 'không' || next_r7 === 'không' || next_r6 === 'k (không phép)' || next_r7 === 'k (không phép)';
              
              const next2_r6 = String(rows[bestRowIndex]?.[c+2] || '').trim().toLowerCase();
              const next2_r7 = String(rows[bestRowIndex + 1]?.[c+2] || '').trim().toLowerCase();
              const isTong = next2_r6.includes('tổng') || next2_r7.includes('tổng') || next2_r6 === 'tong' || next2_r7 === 'tong';
              
              if (isK && isTong) {
                pIdx = c;
                kIdx = c + 1;
                tongIdx = c + 2;
                break;
              }
            }
          }

          // Fallback if not found consecutively
          if (pIdx === -1) {
            for (let c = 0; c < headersList.length; c++) {
              const r6_val = String(rows[bestRowIndex]?.[c] || '').trim().toLowerCase();
              const r7_val = String(rows[bestRowIndex + 1]?.[c] || '').trim().toLowerCase();
              if (r6_val === 'p' || r7_val === 'p' || r6_val === 'có phép' || r7_val === 'có phép') {
                pIdx = c;
              }
              if (r6_val === 'k' || r7_val === 'k' || r6_val === 'không phép' || r7_val === 'không phép') {
                kIdx = c;
              }
              if ((r6_val.includes('tổng') || r7_val.includes('tổng')) && c > 10) {
                if (r6_val.includes('buổi nghỉ') || r7_val.includes('buổi nghỉ') || r6_val.includes('vắng') || r7_val.includes('vắng') || c === pIdx + 2 || c === kIdx + 1) {
                  tongIdx = c;
                }
              }
            }
          }

          const conductKey = conductColIdx !== -1 ? headersList[conductColIdx] : undefined;
          const absencesExKey = pIdx !== -1 ? headersList[pIdx] : undefined;
          const absencesUnexKey = kIdx !== -1 ? headersList[kIdx] : undefined;
          const absencesTongKey = tongIdx !== -1 ? headersList[tongIdx] : undefined;
          const noteKey = ghiChuColIdx !== -1 ? headersList[ghiChuColIdx] : undefined;

          const subjectHeaders = headersList.filter(h => {
            if ([sttKey, nameKey, classKey].includes(h)) return false;
            if (conductKey === h || absencesExKey === h || absencesUnexKey === h || absencesTongKey === h || noteKey === h) return false;
            return isAcademicSubject(h);
          });

          subjectHeaders.forEach(h => newSubjectHeaders.add(h));

          const processed: StudentData[] = [];
          for (let j = bestRowIndex + 1; j < rows.length; j++) {
            const dataRow = rows[j];
            if (!dataRow || !Array.isArray(dataRow)) continue;

            const item: any = {};
            headersList.forEach((h, colIdx) => {
              item[h] = dataRow[colIdx] !== undefined ? dataRow[colIdx] : '';
            });
            item._rowIndex = j;

            const cleanedName = String(item[nameKey] || '').trim().replace(/\s+/g, ' ');
            const isCleanedNameValid = cleanedName && 
              cleanedName.length >= 1 &&
              !['họ tên', 'họ và tên', 'họ & tên', 'tên học sinh', 'tên', 'lớp trưởng', 'bí thư'].includes(cleanedName.toLowerCase()) &&
              !['giáo viên chủ nhiệm', 'gvcn', 'hiệu trưởng', 'tổng cộng', 'người lập', 'trung bình', 'năm học', 'ngày tháng', 'ngày lập', 'ngày ký', 'ngày kí', 'ngày...'].some(keyword => cleanedName.toLowerCase().includes(keyword));

            if (isCleanedNameValid) {
              if (!item[classKey]) item[classKey] = wsname;
              
              const student = processRawStudentData(item, subjectHeaders, { 
                nameKey, 
                classKey, 
                sttKey,
                conductKey,
                absencesExKey,
                absencesUnexKey,
                absencesTongKey,
                noteKey
              });
              if (student) {
                processed.push(student);
              }
            }
          }

          newProcessedStudents = [...newProcessedStudents, ...processed];
        });

        if (newProcessedStudents.length > 0) {
          // Deduplicate the newly analyzed students list to avoid duplicates in the same file
          const uniqueNewProcessed: StudentData[] = [];
          const seenInNew = new Set<string>();
          newProcessedStudents.forEach(s => {
            const key = `${s.className}-${s.name}-${s.id}`.toLowerCase();
            if (!seenInNew.has(key)) {
              seenInNew.add(key);
              uniqueNewProcessed.push(s);
            }
          });

          setHeaders(prev => Array.from(new Set([...prev, ...Array.from(newSubjectHeaders)])));
          setAllStudents(prev => {
            // Remove existing students that are also present in the new set (same class, student name, and id)
            const newKeys = new Set(uniqueNewProcessed.map(s => `${s.className}-${s.name}-${s.id}`.toLowerCase()));
            const filteredPrev = prev.filter(s => !newKeys.has(`${s.className}-${s.name}-${s.id}`.toLowerCase()));
            return [...filteredPrev, ...uniqueNewProcessed];
          });
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setLoading(false); 
        e.target.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleTeacherAssignmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        const newTeacherNames: Record<string, string> = { ...teacherNames };
        const newSubjectTeachers: Record<string, Record<string, string>> = { ...subjectTeachers };
        
        let processedAny = false;

        wb.SheetNames.forEach(wsname => {
          const ws = wb.Sheets[wsname];
          const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
          if (rows.length === 0) return;

          let headerIdx = -1;
          for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i];
            if (row.some(cell => {
              const str = String(cell || '').trim().toLowerCase();
              return str === 'lớp' || str === 'class' || str === 'tên lớp' || str === 'lop';
            })) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx === -1) return;

          const headersList = rows[headerIdx].map(h => String(h || '').trim());
          const classColIdx = headersList.findIndex(h => {
            const l = h.toLowerCase();
            return l === 'lớp' || l === 'class' || l === 'tên lớp' || l === 'lop';
          });
          const gvcnColIdx = headersList.findIndex(h => {
            const l = h.toLowerCase();
            return l === 'gvcn' || l === 'giáo viên chủ nhiệm' || l === 'chủ nhiệm' || l === 'chu nhiem' || l === 'chủ nhiệm lớp';
          });

          for (let j = headerIdx + 1; j < rows.length; j++) {
            const row = rows[j];
            const className = String(row[classColIdx] || '').trim();
            if (!className) continue;

            processedAny = true;
            
            if (gvcnColIdx !== -1) {
              const gvcnName = String(row[gvcnColIdx] || '').trim();
              if (gvcnName) {
                newTeacherNames[className] = gvcnName;
              }
            }

            if (!newSubjectTeachers[className]) {
              newSubjectTeachers[className] = {};
            }

            headersList.forEach((h, colIdx) => {
              if (colIdx === classColIdx || colIdx === gvcnColIdx) return;
              if (!h) return;

              const teacherVal = String(row[colIdx] || '').trim();
              if (teacherVal) {
                const matchedHeader = headers.find(exHeader => isSameSubject(exHeader, h));
                if (matchedHeader) {
                  newSubjectTeachers[className][matchedHeader] = teacherVal;
                } else {
                  newSubjectTeachers[className][h] = teacherVal;
                }
              }
            });
          }
        });

        if (processedAny) {
          setTeacherNames(newTeacherNames);
          setSubjectTeachers(newSubjectTeachers);
          alert("Nạp thông tin phân công giảng dạy thành công!");
        } else {
          alert("Không tìm thấy dữ liệu phân công giảng dạy hợp lệ. Vui lòng kiểm tra lại cột 'Lớp' trong file Excel mẫu.");
        }
      } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra khi nạp phân công: " + (err as Error).message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTeacherSampleExcel = () => {
    const sampleData = [
      {
        'Lớp': '10A1',
        'Giáo viên chủ nhiệm': 'Cô Nguyễn Thu Hà',
        'Toán': 'Thầy Trần Quốc Hải',
        'Văn': 'Cô Nguyễn Minh Phượng',
        'Anh': 'Cô Lê Thùy Dương',
        'Lý': 'Thầy Vũ Hoàng Gia',
        'Hóa': 'Cô Phạm Thị Liên',
        'Sinh': 'Thầy Nguyễn Trọng Tố',
        'Sử': 'Cô Đặng Ngọc Trâm',
        'Địa': 'Thầy Đỗ Xuân Huy',
        'GDCD': 'Cô Mai Ánh Tuyết'
      },
      {
        'Lớp': '10A2',
        'Giáo viên chủ nhiệm': 'Thầy Lê Quang Minh',
        'Toán': 'Thầy Trần Quốc Hải',
        'Văn': 'Cô Chu Kim Chi',
        'Anh': 'Cô Nguyễn Khánh Ly',
        'Lý': 'Cô Nguyễn Hồng Nhung',
        'Hóa': 'Thầy Hoàng Thế Anh',
        'Sinh': 'Cô Đỗ Thúy Quỳnh',
        'Sử': 'Thầy Đinh Ngọc Tú',
        'Địa': 'Thầy Đỗ Xuân Huy',
        'GDCD': 'Cô Mai Ánh Tuyết'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Phan_Cong_Giang_Day");
    
    ws['!cols'] = [
      { wch: 10 }, { wch: 25 }, { wch: 22 }, 
      { wch: 22 }, { wch: 22 }, { wch: 22 }, 
      { wch: 22 }, { wch: 22 }, { wch: 22 },
      { wch: 22 }, { wch: 22 }
    ];

    XLSX.writeFile(wb, "Mau_Phan_Cong_Giang_Day.xlsx");
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      {
        'STT': 1,
        'Họ và Tên': 'Nguyễn Văn A',
        'Lớp': '10A1',
        'Toán': 8.5,
        'Văn': 7.0,
        'Anh': 9.0,
        'Lý': 6.5,
        'Hóa': 8.0,
        'Sinh': 7.5,
        'Sử': 8.0,
        'Địa': 7.0,
        'GDCD': 9.0
      },
      {
        'STT': 2,
        'Họ và Tên': 'Trần Thị B',
        'Lớp': '10A1',
        'Toán': 4.5,
        'Văn': 5.0,
        'Anh': 5.5,
        'Lý': 4.0,
        'Hóa': 3.5,
        'Sinh': 5.0,
        'Sử': 6.0,
        'Địa': 5.5,
        'GDCD': 7.0
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Diem_Thi");
    
    // Căn chỉnh độ rộng cột
    ws['!cols'] = [
      { wch: 5 }, { wch: 20 }, { wch: 10 }, 
      { wch: 8 }, { wch: 8 }, { wch: 8 }, 
      { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }
    ];

    XLSX.writeFile(wb, "Mau_File_Diem_Thi.xlsx");
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
        'Học tập (TT22)': s.classification,
        'Rèn luyện (TT22)': s.conduct || 'Tốt',
        'Nghỉ phép (P)': s.absencesExcused || 0,
        'Nghỉ không phép (K)': s.absencesUnexcused || 0,
        'Tổng nghỉ': s.absencesTotal || 0,
        'Dự báo Danh hiệu': s.merit || 'Không',
        'Trạng thái': s.promotionStatus || 'Không rõ',
        'Môn cần khắc phục': s.remedialSubjects && s.remedialSubjects.length > 0 ? s.remedialSubjects.join(', ') : '-',
        'Ghi chú': s.note || '',
        'GV Chủ nhiệm': teacherNames[s.className] || '',
      };
      s.scores.forEach(scoreObj => { row[scoreObj.name] = scoreObj.score; });
      row['Mục tiêu bứt phá (Học kỳ tới)'] = s.goals.length > 0 
        ? s.goals.map(g => `${g.subjectName}: ${g.currentScore} → ${g.targetScore.toFixed(1)}`).join('; ')
        : (s.classification === StudentClassification.TOT ? "Duy trì phong độ Tốt nâng cao." : "Cần nỗ lực cải thiện đều các môn.");
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 25 },
      { wch: 25 }, { wch: 20 }, { wch: 20 }, ...headers.map(() => ({ wch: 8 })), { wch: 50 }
    ];
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

  const updateSubjectTeacher = (className: string, subject: string, teacherName: string) => {
    setSubjectTeachers(prev => ({
      ...prev,
      [className]: {
        ...(prev[className] || {}),
        [subject]: teacherName
      }
    }));
  };

  const chartData = [
    { name: 'Tốt', value: stats.totCount, fill: '#10b981' },
    { name: 'TC Tốt', value: stats.tiemCanTotCount, fill: '#3b82f6' },
    { name: 'Khá', value: stats.khaCount, fill: '#6366f1' },
    { name: 'TC Khá', value: stats.tiemCanKhaCount, fill: '#a855f7' },
    { name: 'Đạt', value: stats.datCount, fill: '#eab308' },
    { name: 'Nguy cơ', value: stats.tiemCanDatCount, fill: '#f97316' },
    { name: 'Nguy hiểm', value: stats.chuaDatCount, fill: '#f43f5e' },
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
    const classSubjectTeachers = subjectTeachers[student.className] || {};
    
    const renderPolarAngleAxis = ({ payload, x, y, cx, cy }: any) => {
      const dataPoint = radarData.find(d => d.subject === payload.value);
      const score = dataPoint ? dataPoint.A.toFixed(1) : "";
      const sTeacher = classSubjectTeachers[payload.value];
      
      return (
        <g transform={`translate(${x},${y})`}>
          <text x={0} y={0} dy={4} textAnchor={x > cx ? 'start' : x < cx ? 'end' : 'middle'} className="fill-slate-600 text-[10px] font-black">{payload.value}</text>
          <text x={0} y={12} dy={4} textAnchor={x > cx ? 'start' : x < cx ? 'end' : 'middle'} className="fill-indigo-600 text-[9px] font-black">({score})</text>
          {sTeacher && (
            <text x={0} y={22} dy={4} textAnchor={x > cx ? 'start' : x < cx ? 'end' : 'middle'} className="fill-slate-400 text-[7px] font-bold italic">GV: {sTeacher}</text>
          )}
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

              {student.remedialSubjects && student.remedialSubjects.length > 0 && (
                <div className="bg-rose-50/75 p-6 rounded-[32px] border border-rose-100 shadow-inner">
                  <h5 className="flex items-center gap-3 text-xs font-black text-rose-500 uppercase tracking-widest mb-4">
                    <TrendingDown className="w-5 h-5 text-rose-500" /> Môn cần khắc phục
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {student.remedialSubjects.map((sub, i) => (
                      <span key={i} className="px-2.5 py-1 bg-white text-rose-700 border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm">
                        {sub}
                      </span>
                    ))}
                  </div>
                  <p className="text-[9px] text-rose-400 font-bold mt-2 leading-relaxed">
                    Ưu tiên khắc phục điểm số các môn này để nâng mức xếp loại học lực kế tiếp.
                  </p>
                </div>
              )}

              {/* Kết quả Rèn luyện & Chuyên cần & Danh hiệu */}
              <div className="bg-gradient-to-br from-indigo-50 to-slate-50 p-6 rounded-[32px] border border-indigo-100/50 shadow-inner space-y-4">
                <h5 className="flex items-center gap-3 text-xs font-black text-indigo-900 uppercase tracking-widest">
                  <Award className="w-5 h-5 text-indigo-600" /> Đánh giá & Rèn luyện
                </h5>
                <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                  <div className="bg-white p-3 rounded-2xl border border-slate-100/80 shadow-sm text-center">
                    <span className="text-[10px] text-slate-400 block uppercase font-black">Rèn luyện</span>
                    <span className="text-xs font-black text-slate-900">{student.conduct || 'Tốt'}</span>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-100/80 shadow-sm text-center">
                    <span className="text-[10px] text-slate-400 block uppercase font-black font-sans">Nghỉ (P/K)</span>
                    <span className="text-[11px] font-black text-slate-900">{(student.absencesExcused || 0) + (student.absencesUnexcused || 0)} ({student.absencesExcused || 0}/{student.absencesUnexcused || 0})</span>
                  </div>
                </div>
                {student.merit && (
                  <div className="bg-amber-100/30 p-3 rounded-2xl border border-amber-200/50 flex items-center gap-2 shadow-sm">
                    <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-[8px] text-amber-600 font-extrabold uppercase leading-none mb-0.5">Danh hiệu đạt được</p>
                      <p className="text-[11px] font-black text-slate-950 leading-none">{student.merit}</p>
                    </div>
                  </div>
                )}
                {student.promotionStatus && (
                  <div className={`p-2.5 rounded-2xl border text-center font-black text-[10px] tracking-wide uppercase ${
                    student.promotionStatus.includes('Được lên lớp') 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-rose-50 text-rose-700 border-rose-100'
                  }`}>
                    {student.promotionStatus}
                  </div>
                )}
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
          <div className="pt-8 border-t border-slate-100 flex justify-end items-center">
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
    <div className={`min-h-screen flex flex-col transition-all duration-500 ${
      presentationTheme === 'green-mint' ? 'bg-[#ebfbf2]' :
      presentationTheme === 'orange-pastel' ? 'bg-[#fff6ee]' :
      presentationTheme === 'blue-sky' ? 'bg-[#f0f8ff]' :
      'bg-slate-50'
    }`} translate="no">
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
                {/* Bộ mô phỏng rèn luyện & Chuyên cần */}
                <div className="bg-slate-50 rounded-[32px] border border-slate-200/50 p-6 space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Award className="w-4 h-4 text-indigo-600" /> Giả lập Rèn luyện</h4>
                  <div className="space-y-2">
                    <label className="text-[11px] font-extrabold text-slate-500 block">Kết quả rèn luyện:</label>
                    <select 
                      value={simulatedConduct}
                      onChange={(e) => setSimulatedConduct(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm font-sans"
                    >
                      <option value="Tốt">Tốt</option>
                      <option value="Khá">Khá</option>
                      <option value="Đạt">Đạt</option>
                      <option value="Chưa đạt">Chưa đạt</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-extrabold text-slate-500">Giả lập số buổi nghỉ:</span>
                      <span className="font-black text-slate-900 bg-white border border-slate-100 px-2 py-0.5 rounded-lg shadow-sm">{simulatedAbsences} buổi</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="50" 
                      step="1" 
                      value={simulatedAbsences} 
                      onChange={(e) => setSimulatedAbsences(parseInt(e.target.value) || 0)}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                    />
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden text-center">
                  <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-4">Kết quả mô phỏng</h4>
                  <div className="text-[10px] font-bold text-slate-400 line-through mb-1">{simulatingStudent.classification}</div>
                  <ArrowRight className="w-4 h-4 mx-auto text-white/20 mb-2" />
                  <div className={`px-5 py-2 rounded-2xl text-xs font-black uppercase border shadow-lg mx-auto w-fit ${getClassificationStyles(simulationResult?.classification as StudentClassification)}`}>
                    {simulationResult?.classification}
                  </div>
                  
                  {/* Dự kiến khen thưởng & Lên lớp giả lập */}
                  <div className="mt-6 pt-6 border-t border-white/10 space-y-3 text-left">
                    {simulationResult?.merit ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <div>
                          <p className="text-[8px] text-amber-300 font-extrabold uppercase leading-none mb-0.5">Dự kiến Khen thưởng</p>
                          <p className="text-[10px] font-black text-amber-200 leading-none">{simulationResult.merit}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl text-center text-[9px] text-slate-400 font-bold uppercase">
                        Chưa đạt danh hiệu khen thưởng
                      </div>
                    )}

                    <div className={`p-2.5 border rounded-xl text-center text-[10px] font-black uppercase tracking-wider ${
                      simulationResult?.promotionStatus?.includes("Được lên lớp") 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}>
                      {simulationResult?.promotionStatus || "N/A"}
                    </div>

                    {simulationResult?.alerts && simulationResult.alerts.length > 0 && (
                      <div className="space-y-1 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 max-h-24 overflow-y-auto custom-scrollbar">
                        <p className="text-[8px] text-rose-300 font-black uppercase">Cảnh báo giả lập:</p>
                        {simulationResult.alerts.map((al, aIdx) => (
                          <p key={aIdx} className="text-[9px] font-medium text-rose-200">⚠️ {al}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

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

      {commentingStudent && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-8 border-b flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-100">
                  <PenTool className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Gợi ý nhận xét học bạ tự động</h3>
                  <p className="text-sm font-bold text-slate-400">
                    Học sinh: <span className="text-indigo-600 font-extrabold">{commentingStudent.name}</span> (Lớp {commentingStudent.className})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setCommentingStudent(null);
                  setCopiedText(null);
                }} 
                className="p-3 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                id="comment-close-btn"
              >
                <X className="w-6 h-6 text-slate-600" />
              </button>
            </div>

            {/* Student Stats Bar */}
            <div className="px-8 py-4 bg-indigo-50/50 border-b flex flex-wrap gap-4 items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Học lực (TT22):</span>
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-black uppercase">
                  {getAcademicLevel(commentingStudent.classification)}
                </span>
                <span className="text-xs text-slate-400">({commentingStudent.classification})</span>
              </div>
              <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Rèn luyện (TT22):</span>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-black uppercase">
                  {commentingStudent.conduct || 'Tốt'}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl text-xs font-bold">
                <Sparkles className="w-4 h-4 text-emerald-500" /> Bản sư phạm chuẩn mực (Không dùng AI)
              </div>
            </div>

            {/* Sidebar/Navigation tabs inside the modal */}
            <div className="border-b px-8 shrink-0 flex gap-4 bg-slate-50/20">
              <button
                onClick={() => setCommentTab('COMBINED')}
                className={`py-4 font-black text-sm relative transition-all ${
                  commentTab === 'COMBINED' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Mẫu nhận xét kết hợp
              </button>
              <button
                onClick={() => setCommentTab('SHORT')}
                className={`py-4 font-black text-sm relative transition-all ${
                  commentTab === 'SHORT' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Mẫu ngắn ghi học bạ
              </button>
              <button
                onClick={() => setCommentTab('TRAITS')}
                className={`py-4 font-black text-sm relative transition-all ${
                  commentTab === 'TRAITS' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                5 phẩm chất & 10 năng lực
              </button>
            </div>

            {/* Modal Body Scroll Container */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 space-y-6">
              
              {commentTab === 'COMBINED' && (() => {
                const ac = getAcademicLevel(commentingStudent.classification);
                const cd = commentingStudent.conduct || 'Tốt';
                const list = getCombinedComments(ac, cd, commentingStudent.name);
                return (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 flex items-start gap-3">
                      <BookOpen className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider mb-0.5">Xác định tổ hợp logic</p>
                        <p className="text-sm font-medium">Xếp vào tổ hợp: <strong>Học lực {ac} - Hạnh kiểm {cd}</strong>. Hệ thống hiển thị 3 mẫu nhận xét khác nhau cho bạn tùy ý lựa chọn sao chép:</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {list.map((comment, index) => {
                        const isCopied = copiedText === comment;
                        return (
                          <div 
                            key={index} 
                            className={`p-6 rounded-3xl border transition-all hover:shadow-md bg-white flex flex-col justify-between gap-4 ${
                              isCopied ? 'border-emerald-300 bg-emerald-50/10' : 'border-slate-100'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black uppercase">
                                  Mẫu lựa chọn {index + 1}
                                </span>
                              </div>
                              <p className="text-slate-800 text-sm leading-relaxed font-semibold">
                                {comment}
                              </p>
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(comment);
                                  setCopiedText(comment);
                                  setTimeout(() => setCopiedText(null), 2000);
                                }}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black text-xs border ${
                                  isCopied 
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' 
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                                }`}
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-4 h-4" /> ✓ Đã sao chép
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" /> Sao chép nhanh
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {commentTab === 'SHORT' && (() => {
                const ac = getAcademicLevel(commentingStudent.classification);
                const comment = getShortHocBaComment(ac, commentingStudent.name);
                const isCopied = copiedText === comment;
                return (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 flex items-start gap-3">
                      <FileText className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider mb-0.5">Mẫu nhận xét ngắn gọn theo quy chế</p>
                        <p className="text-sm font-medium">Sử dụng tóm gọn kết quả tổng quát theo các mức định hướng của Thông tư 22 để ghi học bạ nhanh chóng:</p>
                      </div>
                    </div>

                    <div 
                      className={`p-8 rounded-3xl border transition-all hover:shadow-md bg-white flex flex-col justify-between gap-6 ${
                        isCopied ? 'border-emerald-300 bg-emerald-50/10' : 'border-slate-100 shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                            Nhận xét Học bạ (Mức {ac})
                          </span>
                        </div>
                        <p className="text-slate-800 text-base leading-relaxed font-extrabold text-indigo-900">
                          {comment}
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(comment);
                            setCopiedText(comment);
                            setTimeout(() => setCopiedText(null), 2000);
                          }}
                          className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-black text-sm border ${
                            isCopied 
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' 
                              : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-4.5 h-4.5" /> ✓ Đã sao chép
                            </>
                          ) : (
                            <>
                              <Copy className="w-4.5 h-4.5" /> Sao chép nhanh
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {commentTab === 'TRAITS' && (() => {
                const name = commentingStudent.name;
                const repl = (txt: string) => txt.replace(/\{name\}/g, name);

                return (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Phẩm chất */}
                    <div>
                      <h4 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-indigo-500" /> Nhận xét theo 5 phẩm chất chính
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {PHAM_CHAT_LIST.map((item, idx) => {
                          const rawText = repl(item.text);
                          const isCopied = copiedText === rawText;
                          return (
                            <div 
                              key={idx} 
                              className={`p-4 rounded-2xl border transition-all hover:shadow-xs bg-white flex flex-col justify-between gap-3 ${
                                isCopied ? 'border-emerald-300 bg-emerald-50/10' : 'border-slate-100'
                              }`}
                            >
                              <div>
                                <span className="font-extrabold text-xs text-indigo-600 block mb-1">
                                  Phẩm chất {item.key}
                                </span>
                                <p className="text-slate-700 text-xs leading-relaxed font-semibold">
                                  {rawText}
                                </p>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(rawText);
                                    setCopiedText(rawText);
                                    setTimeout(() => setCopiedText(null), 2000);
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-black text-[10px] border ${
                                    isCopied 
                                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  {isCopied ? 'Đã chép' : 'Sao chép'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Năng lực */}
                    <div>
                      <h4 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-rose-500" /> Nhận xét theo các năng lực cốt lõi
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {NANG_LUC_LIST.map((item, idx) => {
                          const rawText = repl(item.text);
                          const isCopied = copiedText === rawText;
                          return (
                            <div 
                              key={idx} 
                              className={`p-4 rounded-2xl border transition-all hover:shadow-xs bg-white flex flex-col justify-between gap-3 ${
                                isCopied ? 'border-emerald-300 bg-emerald-50/10' : 'border-slate-100'
                              }`}
                            >
                              <div>
                                <span className="font-extrabold text-xs text-rose-600 block mb-1">
                                  Năng lực {item.key}
                                </span>
                                <p className="text-slate-700 text-xs leading-relaxed font-semibold">
                                  {rawText}
                                </p>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(rawText);
                                    setCopiedText(rawText);
                                    setTimeout(() => setCopiedText(null), 2000);
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-black text-[10px] border ${
                                    isCopied 
                                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  {isCopied ? 'Đã chép' : 'Sao chép'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Footer */}
            <div className="p-8 bg-slate-50 border-t flex justify-end shrink-0">
              <button 
                onClick={() => {
                  setCommentingStudent(null);
                  setCopiedText(null);
                }} 
                className="px-10 py-4 bg-slate-800 text-white rounded-[20px] font-black text-sm hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-slate-100"
              >
                Hoàn tất rà soát
              </button>
            </div>
          </div>
        </div>
      )}

      {isGuideOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl text-white">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Hướng dẫn Xếp loại & Quy chuẩn Thông tư 22</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Tiêu chuẩn đánh giá lực học và phân lớp thông minh</p>
                </div>
              </div>
              <button onClick={() => setIsGuideOpen(false)} className="p-2 bg-slate-200/60 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-600" /></button>
            </div>
            
            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1">
              <div>
                <h4 className="text-sm font-black text-slate-900 border-l-4 border-indigo-600 pl-3 mb-4 uppercase tracking-wider">Xếp loại Học lực (Hệ thống 7 mức độ)</h4>
                <p className="text-xs text-slate-500 font-bold mb-6">Chương trình sử dụng cách tính chuẩn theo TT22 kết hợp các trạng thái cảnh báo sớm cho giáo viên chủ nhiệm.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tốt */}
                  <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="px-3 py-1 bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">Học sinh Tốt</span>
                      <span className="text-[10px] font-black text-emerald-600">Chuẩn TT22</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">📌 Tiêu chuẩn:</p>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4 font-semibold">
                      <li>Ít nhất 6 môn học đạt điểm trung bình <strong className="text-slate-900">≥ 8.0</strong></li>
                      <li>Tất cả các môn học còn lại đạt điểm trung bình <strong className="text-slate-900">≥ 6.5</strong></li>
                      <li>Các môn nhận xét (nếu có) đạt mức <strong className="text-slate-900">Đạt</strong></li>
                    </ul>
                  </div>

                  {/* Tiệm cận Tốt */}
                  <div className="p-5 rounded-2xl border border-blue-100 bg-blue-50/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="px-3 py-1 bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">Tiệm cận Tốt</span>
                      <span className="text-[10px] font-black text-blue-600">Phân loại Sư phảm</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">📌 Tiêu chuẩn:</p>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4 font-semibold">
                      <li>Có 4 hoặc 5 môn đạt điểm trung bình <strong className="text-slate-900">≥ 8.0</strong> và điểm thấp nhất <strong className="text-slate-900">≥ 6.5</strong></li>
                      <li>HOẶC có <strong className="text-slate-900">≥ 6 môn ≥ 8.0</strong> và dính duy nhất <strong className="text-slate-900">1 môn dưới 6.5</strong></li>
                      <li><em className="text-blue-600">Mục tiêu:</em> Chỉ thiếu ranh giới rất nhỏ (+0.5 điểm) để bứt phá lên mức Tốt.</li>
                    </ul>
                  </div>

                  {/* Khá */}
                  <div className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="px-3 py-1 bg-indigo-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">Học sinh Khá</span>
                      <span className="text-[10px] font-black text-indigo-600">Chuẩn TT22</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">📌 Tiêu chuẩn:</p>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4 font-semibold">
                      <li>Ít nhất 6 môn học đạt điểm trung bình <strong className="text-slate-900">≥ 6.5</strong></li>
                      <li>Tất cả các môn học còn lại đạt điểm trung bình <strong className="text-slate-900">≥ 5.0</strong></li>
                      <li>Các môn nhận xét đạt mức <strong className="text-slate-900">Đạt</strong></li>
                    </ul>
                  </div>

                  {/* Tiệm cận Khá */}
                  <div className="p-5 rounded-2xl border border-purple-100 bg-purple-50/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="px-3 py-1 bg-purple-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">Tiệm cận Khá</span>
                      <span className="text-[10px] font-black text-purple-600">Phân loại Sư phảm</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">📌 Tiêu chuẩn:</p>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4 font-semibold">
                      <li>Có 4 hoặc 5 môn đạt điểm trung bình <strong className="text-slate-900">≥ 6.5</strong> và điểm thấp nhất <strong className="text-slate-900">≥ 5.0</strong></li>
                      <li>HOẶC có <strong className="text-slate-900">≥ 6 môn ≥ 6.5</strong> và dính duy nhất <strong className="text-slate-900">1 môn dưới 5.0</strong></li>
                      <li><em className="text-purple-600">Mục tiêu:</em> Tập trung cải thiện môn học bị khống chế để thăng hạng Khá.</li>
                    </ul>
                  </div>

                  {/* Đạt */}
                  <div className="p-5 rounded-2xl border border-amber-100 bg-amber-50/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="px-3 py-1 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">Học sinh Đạt</span>
                      <span className="text-[10px] font-black text-amber-600">Chuẩn TT22</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">📌 Tiêu chuẩn:</p>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4 font-semibold">
                      <li>Ít nhất 6 môn học đạt điểm trung bình <strong className="text-slate-900">≥ 5.0</strong></li>
                      <li>Tất cả các môn học còn lại đạt điểm trung bình <strong className="text-slate-900">≥ 3.5</strong></li>
                      <li>Không nằm dưới ngưỡng an toàn (không thuộc nhóm Nguy cơ bị khống chế)</li>
                    </ul>
                  </div>

                  {/* Nguy cơ */}
                  <div className="p-5 rounded-2xl border border-orange-100 bg-orange-50/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="px-3 py-1 bg-orange-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">Nguy cơ</span>
                      <span className="text-[10px] font-black text-orange-600">Cảnh báo Đỏ</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">📌 Tiêu chuẩn:</p>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4 font-semibold">
                      <li>Có ít nhất 6 môn đạt điểm trung bình <strong className="text-slate-900">≥ 5.0</strong> nhưng điểm thấp nhất <strong className="text-slate-900">&lt; 4.0</strong> (sát vạch đỏ 3.5)</li>
                      <li>HOẶC chỉ vừa tròn đúng <strong className="text-slate-900">6 môn đạt ≥ 5.0</strong> (ngoài ra đều dưới 5.0)</li>
                      <li><em className="text-orange-600">Báo động:</em> Học sinh rất dễ rơi thẳng xuống mức Chưa Đạt (Nguy hiểm) nếu điểm số sụt giảm thêm.</li>
                    </ul>
                  </div>

                  {/* Nguy hiểm */}
                  <div className="p-5 rounded-2xl border border-rose-100 bg-rose-50/5 space-y-2 md:col-span-2">
                    <div className="flex justify-between items-center">
                      <span className="px-3 py-1 bg-rose-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">Nguy hiểm</span>
                      <span className="text-[10px] font-black text-rose-600">Trạng thái Khẩn cấp</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">📌 Tiêu chuẩn & Hệ quả:</p>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4 font-semibold">
                      <li>Có <strong className="text-slate-900">ít hơn 6 môn</strong> đạt điểm trung bình ≥ 5.0 HOẶC có môn bất kỳ bị điểm liệt dưới <strong className="text-slate-900">3.5</strong>.</li>
                      <li><em className="text-rose-600">Yêu cầu sư phạm:</em> Phải bồi dưỡng tăng cường môn học kém, kèm cặp học tập và tham gia đợt thi kiểm tra lại trong hè để xét điều kiện vớt lên lớp.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t font-sans">
                {/* Lên lớp quy định */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-900 border-l-4 border-indigo-600 pl-3 uppercase tracking-wider">Điều kiện Lên lớp (Điều 12 TT22)</h4>
                  <div className="bg-slate-50 p-5 rounded-2xl border space-y-3 text-xs text-slate-600 leading-relaxed">
                    <div className="flex items-start gap-2">
                      <strong className="text-indigo-600 shrink-0">✔ Lực học & Rèn luyện:</strong>
                      <span>Mức học lực đạt từ <strong className="text-slate-900">Đạt trở lên</strong> (gồm cả Nguy cơ) và kết quả rèn luyện cả năm đạt từ mức <strong className="text-slate-900">Đạt trở lên</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <strong className="text-indigo-600 shrink-0">✔ Giới hạn chuyên cần:</strong>
                      <span>Nghỉ học cả năm <strong className="text-slate-900">không quá 45 buổi</strong> (kể cả có phép hay không phép). Vượt quá 45 buổi sẽ phải ở lại lớp thẳng.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <strong className="text-indigo-600 shrink-0">✔ Kiểm tra lại hè:</strong>
                      <span>Học sinh xếp loại Nguy hiểm (Chưa đạt) hoặc xếp loại Rèn luyện Chưa đạt mà nghỉ dưới 45 buổi sẽ làm bài kiểm tra lại các môn dưới trung bình để xét điều kiện thăng hạng thăng lớp.</span>
                    </div>
                  </div>
                </div>

                {/* Danh hiệu khen thưởng */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-900 border-l-4 border-indigo-600 pl-3 uppercase tracking-wider">Khen thưởng (Điều 15 TT22)</h4>
                  <div className="bg-slate-50 p-5 rounded-2xl border space-y-3 text-xs text-slate-600 leading-relaxed">
                    <div className="flex items-start gap-2">
                      <strong className="text-emerald-600 shrink-0">🏅 Xuất sắc:</strong>
                      <span>Học lực <strong className="text-slate-900">Tốt</strong>, kết quả rèn luyện <strong className="text-slate-900">Tốt</strong>, và có ít nhất <strong className="text-slate-900">6 môn học có điểm trung bình ≥ 9.0</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <strong className="text-indigo-600 shrink-0">🏅 Học sinh Giỏi:</strong>
                      <span>Học lực đạt loại <strong className="text-slate-900">Tốt</strong> và kết quả rèn luyện cả năm đạt loại <strong className="text-slate-900">Tốt</strong>.</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 italic pt-1">
                      * Chú ý: Các mức kết quả rèn luyện (hạnh kiểm) cả năm của học sinh gồm 4 mức: Tốt, Khá, Đạt, Chưa đạt.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t flex justify-end">
              <button onClick={() => setIsGuideOpen(false)} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl transition shadow-xl shadow-indigo-100">Hiểu rõ quy chuẩn</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b sticky top-0 z-50 no-print">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200"><BrainCircuit className="w-5 h-5 text-white" /></div><div><h1 className="text-xl font-black text-slate-900 tracking-tight">{APP_NAME}</h1><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">{APP_SUBTITLE}</p></div></div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border no-print border-slate-200/60">
              <button onClick={downloadSampleExcel} className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold border border-slate-200"><FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" /> <span>Mẫu Điểm</span></button>
              <button onClick={downloadTeacherSampleExcel} className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold border border-slate-200"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> <span>Mẫu Phân Công</span></button>
              <button onClick={exportToExcelFormatted} className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> <span>Xuất Excel</span></button>
              <button onClick={exportBatchPDF} disabled={exporting || allStudents.length === 0} className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold"><FileText className="w-3.5 h-3.5 text-rose-500" /> <span>PDF Radar</span></button>
            </div>
            <button onClick={() => setIsGuideOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100/60 rounded-xl hover:bg-indigo-100 transition shadow-sm text-xs font-bold"><HelpCircle className="w-3.5 h-3.5 text-indigo-500" /> <span>TT22</span></button>
            <label className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 text-xs font-bold"><Upload className="w-3.5 h-3.5" /> <span>Nạp Điểm</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} /></label>
            <label className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-lg shadow-emerald-100 text-xs font-bold"><UserPlus className="w-3.5 h-3.5" /> <span>Nạp PC Giáo Viên</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleTeacherAssignmentUpload} /></label>
            {allStudents.length > 0 && <button onClick={() => { if(window.confirm("Xác nhận xóa sạch toàn bộ dữ liệu?")) { setAllStudents([]); setHeaders([]); setActiveTab("SUMMARY"); setTeacherNames({}); setSubjectTeachers({}); } }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>}
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
                {activeTab === cls && (
                  <div className="px-2 pt-1 pb-3 animate-in slide-in-from-top-2 duration-300 space-y-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserCheck className="w-3 h-3" /> GV Chủ nhiệm</label>
                      <input type="text" placeholder="Tên GV..." value={teacherNames[cls] || ''} onChange={(e) => updateTeacherName(cls, e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    
                    <div className="bg-white border rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3 py-1.5 border-b"><span className="text-[8px] font-black text-slate-400 uppercase">GV Bộ môn</span></div>
                      <div className="max-h-40 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {headers.map(sub => (
                          <div key={sub} className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 ml-1">{sub}</label>
                            <input 
                              type="text" 
                              placeholder="Tên thầy/cô..." 
                              value={subjectTeachers[cls]?.[sub] || ''} 
                              onChange={(e) => updateSubjectTeacher(cls, sub, e.target.value)} 
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold focus:ring-1 focus:ring-indigo-500 outline-none" 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-auto pt-6 border-t">
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-hidden">
          {allStudents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
              <School className="w-16 h-16 text-slate-200 mb-6" />
              <h2 className="text-2xl font-black text-slate-900 mb-2">{APP_NAME}</h2>
              <p className="text-slate-500 font-bold mb-4">{APP_SUBTITLE}</p>
              <p className="text-slate-400 text-xs mt-8">Tải file điểm để nhận báo cáo phân tích và biểu đồ năng lực đa chiều.</p>
            </div>
          ) : (
            <div className="space-y-8 pedagogical-report" ref={reportRef}>
              {/* Dynamic Style Injection for School Projectors & Accent Themes */}
              <style dangerouslySetInnerHTML={{ __html: `
                /* Ép tiêu đề bảng (table head) luôn có màu đen và cực kỳ rõ nét */
                .pedagogical-report thead,
                .pedagogical-report thead th,
                .pedagogical-report th {
                  color: #000000 !important;
                  font-weight: 900 !important;
                }

                /* Ép toàn bộ các chữ viết màu xám nhạt và các con số mờ nhạt thành MÀU ĐEN ĐẬM để cực rõ nhìn từ xa */
                .pedagogical-report .text-slate-400,
                .pedagogical-report .text-slate-500,
                .pedagogical-report .text-slate-600,
                .pedagogical-report .text-gray-400,
                .pedagogical-report .text-gray-400/90,
                .pedagogical-report .text-gray-500,
                .pedagogical-report .text-slate-500/85,
                .pedagogical-report .text-slate-400/90,
                .pedagogical-report .text-slate-500/80 {
                  color: #000000 !important;
                  font-weight: 700 !important;
                }

                /* Các nhãn nhỏ, nhãn phụ %, sĩ số phụ ghi chú màu xám cũng hiển thị đen tuyền nổi bật */
                .pedagogical-report .text-[10px],
                .pedagogical-report .text-[11px],
                .pedagogical-report .text-[9px],
                .pedagogical-report .text-xs,
                .pedagogical-report span.text-slate-400,
                .pedagogical-report block {
                  color: #000000 !important;
                  font-weight: 800 !important;
                }

                /* Đậm đà thêm cho các tiêu đề phụ, nhãn chỉ mục học lực */
                .pedagogical-report .text-slate-700,
                .pedagogical-report .text-gray-700 {
                  color: #000000 !important;
                  font-weight: 850 !important;
                }

                /* Nền của các hộp thẻ phụ (Card) và viền khi sử dụng phông máy chiếu */
                ${presentationTheme !== 'default' ? `
                  .pedagogical-report .bg-white {
                    border: 2px solid rgba(0, 0, 0, 0.12) !important;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05) !important;
                  }
                  .pedagogical-report .border-slate-100, 
                  .pedagogical-report .border-slate-200, 
                  .pedagogical-report .border {
                    border-color: rgba(0, 0, 0, 0.15) !important;
                    border-width: 1.5px !important;
                  }
                ` : ''}

                /* Font size scale overrides for presentation readability */
                ${fontSizeScale === 'large' ? `
                  .pedagogical-report, 
                  .pedagogical-report table,
                  .pedagogical-report tbody,
                  .pedagogical-report th, 
                  .pedagogical-report td, 
                  .pedagogical-report p, 
                  .pedagogical-report span, 
                  .pedagogical-report div,
                  .pedagogical-report h2,
                  .pedagogical-report h3,
                  .pedagogical-report h4,
                  .pedagogical-report button {
                    font-size: 1.15rem !important;
                  }
                  .pedagogical-report h2 { font-size: 2.2rem !important; }
                  .pedagogical-report h3 { font-size: 1.65rem !important; }
                  .pedagogical-report .text-xs { font-size: 0.95rem !important; }
                  .pedagogical-report .text-[10px] { font-size: 0.9rem !important; }
                  .pedagogical-report .text-[11px] { font-size: 0.95rem !important; }
                  .pedagogical-report .text-[9px] { font-size: 0.85rem !important; }
                ` : ''}
                ${fontSizeScale === 'xlarge' ? `
                  .pedagogical-report, 
                  .pedagogical-report table,
                  .pedagogical-report tbody,
                  .pedagogical-report th, 
                  .pedagogical-report td, 
                  .pedagogical-report p, 
                  .pedagogical-report span, 
                  .pedagogical-report div,
                  .pedagogical-report h2,
                  .pedagogical-report h3,
                  .pedagogical-report h4,
                  .pedagogical-report button {
                    font-size: 1.35rem !important;
                  }
                  .pedagogical-report h2 { font-size: 2.6rem !important; }
                  .pedagogical-report h3 { font-size: 2.0rem !important; }
                  .pedagogical-report .text-xs { font-size: 1.15rem !important; }
                  .pedagogical-report .text-[10px] { font-size: 1.1rem !important; }
                  .pedagogical-report .text-[11px] { font-size: 1.15rem !important; }
                  .pedagogical-report .text-[9px] { font-size: 1.05rem !important; }
                ` : ''}
                ${fontSizeScale === 'huge' ? `
                  .pedagogical-report, 
                  .pedagogical-report table,
                  .pedagogical-report tbody,
                  .pedagogical-report th, 
                  .pedagogical-report td, 
                  .pedagogical-report p, 
                  .pedagogical-report span, 
                  .pedagogical-report div,
                  .pedagogical-report h2,
                  .pedagogical-report h3,
                  .pedagogical-report h4,
                  .pedagogical-report button {
                    font-size: 1.6rem !important;
                  }
                  .pedagogical-report h2 { font-size: 3.2rem !important; }
                  .pedagogical-report h3 { font-size: 2.5rem !important; }
                  .pedagogical-report .text-xs { font-size: 1.35rem !important; }
                  .pedagogical-report .text-[10px] { font-size: 1.3rem !important; }
                  .pedagogical-report .text-[11px] { font-size: 1.35rem !important; }
                  .pedagogical-report .text-[9px] { font-size: 1.25rem !important; }
                ` : ''}
                ${highContrast ? `
                  /* High contrast overrides for washed-out school projectors */
                  .pedagogical-report {
                    background-color: #ffffff !important;
                  }
                  .pedagogical-report .bg-white {
                    background-color: #ffffff !important;
                    border: 2px solid #000000 !important;
                  }
                  .pedagogical-report .bg-slate-50, 
                  .pedagogical-report .bg-slate-100, 
                  .pedagogical-report .bg-slate-50/25, 
                  .pedagogical-report .bg-indigo-50/20,
                  .pedagogical-report .bg-slate-50/50 {
                    background-color: #f1f5f9 !important;
                    border-color: #000000 !important;
                  }
                  .pedagogical-report .text-slate-400,
                  .pedagogical-report .text-slate-500,
                  .pedagogical-report .text-slate-600,
                  .pedagogical-report .text-slate-700,
                  .pedagogical-report .text-gray-450,
                  .pedagogical-report .text-gray-500 {
                    color: #000000 !important;
                    font-weight: 950 !important;
                  }
                  .pedagogical-report .text-slate-900,
                  .pedagogical-report .text-slate-950,
                  .pedagogical-report .text-indigo-950,
                  .pedagogical-report .text-gray-900 {
                    color: #000000 !important;
                    font-weight: 950 !important;
                  }
                  .pedagogical-report .border,
                  .pedagogical-report .border-slate-100,
                  .pedagogical-report .border-slate-200 {
                    border-color: #000000 !important;
                    border-width: 2px !important;
                  }
                  .pedagogical-report table,
                  .pedagogical-report th,
                  .pedagogical-report td,
                  .pedagogical-report tr,
                  .pedagogical-report divide-y > * {
                    border: 2px solid #000000 !important;
                  }
                  .pedagogical-report th {
                    background-color: #cbd5e1 !important;
                    color: #000000 !important;
                    font-weight: 950 !important;
                  }
                  .pedagogical-report strong {
                    font-weight: 950 !important;
                    color: #000000 !important;
                  }
                  .pedagogical-report svg text {
                    fill: #000000 !important;
                    font-weight: 950 !important;
                  }
                ` : ''}
              ` }} />

              {/* PHƯƠNG ÁN NÂNG CẤP GIAO DIỆN TRÌNH CHIẾU HỌC ĐƯỜNG CHUYÊN NGHIỆP (Pedagogical & Classroom Projection Optimizer) */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 shadow-xl border border-slate-800 no-print space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/30">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-indigo-300">Công cụ tối ưu trình chiếu học đường</h3>
                      <p className="text-xs text-slate-300">Nền dịu mắt cùng giải pháp khử chữ xám mờ nhạt sang chữ đen đậm sắc nét!</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3.5 animate-in fade-in duration-500">
                    {/* Background Soft Accent Color Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
                      <span className="text-[10px] uppercase font-black text-slate-300 px-2">Phông nền:</span>
                      <button 
                        onClick={() => setPresentationTheme('green-mint')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${presentationTheme === 'green-mint' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-white/20"></span>
                        <span>Xanh Mint 🌿</span>
                      </button>
                      <button 
                        onClick={() => setPresentationTheme('orange-pastel')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${presentationTheme === 'orange-pastel' ? 'bg-orange-500 text-white shadow-md shadow-orange-950' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] border border-white/20"></span>
                        <span>Cam Nhạt 🍑</span>
                      </button>
                      <button 
                        onClick={() => setPresentationTheme('blue-sky')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${presentationTheme === 'blue-sky' ? 'bg-sky-500 text-white shadow-md shadow-sky-950' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] border border-white/20"></span>
                        <span>Xanh Dương 🔹</span>
                      </button>
                      <button 
                        onClick={() => setPresentationTheme('default')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${presentationTheme === 'default' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-white/20"></span>
                        <span>Gốc ⚙️</span>
                      </button>
                    </div>

                    {/* Size Selector */}
                    <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                      <span className="text-[10px] uppercase font-black text-slate-300 px-2 hidden sm:inline">Cỡ:</span>
                      <button 
                        onClick={() => setFontSizeScale('normal')} 
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${fontSizeScale === 'normal' ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}
                      >
                        1.0x
                      </button>
                      <button 
                        onClick={() => setFontSizeScale('large')} 
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${fontSizeScale === 'large' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                      >
                        1.2x
                      </button>
                      <button 
                        onClick={() => setFontSizeScale('xlarge')} 
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${fontSizeScale === 'xlarge' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                      >
                        1.4x
                      </button>
                      <button 
                        onClick={() => setFontSizeScale('huge')} 
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${fontSizeScale === 'huge' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                      >
                        1.6x 🔥
                      </button>
                    </div>

                    {/* High Contrast Toggle */}
                    <button 
                      onClick={() => setHighContrast(!highContrast)} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                        highContrast 
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' 
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <Zap className={`w-3.5 h-3.5 ${highContrast ? 'fill-current text-slate-950' : 'text-amber-400'}`} />
                      <span>{highContrast ? "Nét máy chiếu: ĐÃ BẬT" : "Nét máy chiếu: TẮT"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  {activeTab !== "SUMMARY" && (
                    <button 
                      onClick={() => setActiveTab("SUMMARY")} 
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100/50 rounded-xl transition duration-200 text-xs font-black mb-3 cursor-pointer shadow-sm no-print"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Quay lại Tổng hợp toàn trường</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2 text-indigo-600 mb-1"><Layers className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">{activeTab === "SUMMARY" ? "Tổng hợp" : `Lớp ${activeTab}`}</span></div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Hiệu suất học tập {activeTab === "SUMMARY" ? "Toàn đơn vị" : activeTab}</h2>
                  {activeTab !== "SUMMARY" && teacherNames[activeTab] && (<p className="text-sm font-bold text-indigo-500 mt-1 flex items-center gap-1"><UserCheck className="w-4 h-4" /> GVCN: {teacherNames[activeTab]}</p>)}
                </div>
                <div className="flex gap-2">
                   <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 flex flex-col items-center shadow-sm"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tổng số</span><span className="text-lg font-black">{stats.total}</span></div>
                   <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 flex flex-col items-center shadow-sm"><span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Tốt + TC</span><span className="text-lg font-black text-emerald-600">{stats.totCount + stats.tiemCanTotCount}</span></div>
                </div>
              </div>

              {/* Thanh chọn view cho Summary */}
              {activeTab === "SUMMARY" && (
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 border border-slate-200/60 rounded-2xl w-fit select-none no-print">
                  <button
                    onClick={() => setSummaryViewMode('OVERVIEW')}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                      summaryViewMode === 'OVERVIEW'
                        ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" /> Báo cáo tổng hợp trường
                  </button>
                  <button
                    onClick={() => setSummaryViewMode('CLASS_WISE')}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                      summaryViewMode === 'CLASS_WISE'
                        ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
                    }`}
                  >
                    <Layers className="w-4 h-4" /> Phân loại theo Lớp
                  </button>
                  <button
                    onClick={() => setSummaryViewMode('SUBJECT_WISE')}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                      summaryViewMode === 'SUBJECT_WISE'
                        ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" /> Phân loại theo Môn học
                  </button>
                  <button
                    onClick={() => setSummaryViewMode('TEACHER_WISE')}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                      summaryViewMode === 'TEACHER_WISE'
                        ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50'
                    }`}
                  >
                    <Users className="w-4 h-4" /> Đánh giá công tác Giáo viên
                  </button>
                </div>
              )}

              {(activeTab !== "SUMMARY" || summaryViewMode === 'OVERVIEW') && (
                <>
              {/* Bảng Cảnh báo Chuyên cần & Rèn luyện */}
              {flaggedStudents.length > 0 && (
                <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-8 border-b bg-amber-50/25 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 animate-bounce" /> 
                        Cảnh báo Chuyên cần & Rèn luyện
                      </h3>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        Danh sách học sinh nghỉ học nhiều, rèn luyện chưa tốt hoặc có cảnh báo sư phạm đặc biệt quan trọng cần nhắc nhở.
                      </p>
                    </div>
                    <span className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-black border border-rose-100">
                      {flaggedStudents.length} học sinh cần lưu ý
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[350px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-black uppercase tracking-widest border-b select-none">
                        <tr>
                          <th className="px-8 py-4">Học sinh</th>
                          <th className="px-8 py-4">Hạnh kiểm (Cả năm)</th>
                          <th className="px-8 py-4">Chuyên cần (Nghỉ)</th>
                          <th className="px-8 py-4">Nội dung Cảnh báo</th>
                          <th className="px-8 py-4 text-right no-print">Thao tác nhanh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {flaggedStudents.map((s, idx) => (
                          <tr key={`flagged-${s.className}-${s.name}-${idx}`} className="hover:bg-amber-50/10 transition-all">
                            <td className="px-8 py-4">
                              <div className="font-extrabold text-slate-900">{s.name}</div>
                              <div className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded w-fit mt-1">{s.className}</div>
                            </td>
                            <td className="px-8 py-4">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                                s.conduct === 'Chưa đạt' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                s.conduct === 'Đạt' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                s.conduct === 'Khá' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                'bg-emerald-50 text-emerald-600 border-emerald-100'
                              }`}>{s.conduct || 'Tốt'}</span>
                            </td>
                            <td className="px-8 py-4 text-xs font-bold text-slate-700 font-sans">
                              <span className="block">Tổng nghỉ: <strong className="text-slate-900">{s.absencesTotal || 0}</strong> buổi</span>
                              <span className="text-[10px] text-slate-400 block font-normal">
                                (Phép: {s.absencesExcused || 0} | Không phép: {s.absencesUnexcused || 0})
                              </span>
                            </td>
                            <td className="px-8 py-4">
                              <div className="flex flex-col gap-1 max-w-sm">
                                {s.alerts && s.alerts.length > 0 ? (
                                  s.alerts.map((al, aIdx) => (
                                    <span key={aIdx} className="text-[11px] font-extrabold text-rose-600 bg-rose-50/75 border border-rose-100/50 px-2 py-0.5 rounded-md w-fit">
                                      ● {al}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[11px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md w-fit">
                                    Theo dõi sát nỗ lực học tập & rèn luyện
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-4 text-right space-x-2 no-print">
                              <button onClick={() => setSimulatingStudent(s)} className="p-1.5 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-black border border-slate-100" title="Mô phỏng bứt phá">
                                <SlidersHorizontal className="w-3.5 h-3.5" /> Mô phỏng
                              </button>
                              <button onClick={() => setSelectedStudentForCard(s)} className="p-1.5 bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-700 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-black border border-slate-100" title="Xem Radar">
                                <BrainCircuit className="w-3.5 h-3.5" /> Radar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col">
                  <h3 className="font-black text-slate-900 flex items-center gap-2 mb-6"><BarChart3 className="w-5 h-5 text-indigo-600" /> Thống kê Xếp loại</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.filter(d => d.value > 0)}>
                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={25}>{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col">
                  <h3 className="font-black text-slate-900 flex items-center gap-2 mb-6"><TrendingUp className="w-5 h-5 text-emerald-600" /> Thống kê Rèn luyện</h3>
                  <div className="h-72 flex flex-col justify-between">
                    <div className="flex-1 min-h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={conductStats.filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {conductStats.filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-3 text-[10px] font-bold pt-3 border-t border-slate-50 flex-wrap font-sans">
                      {conductStats.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                          <span className="text-slate-600">{entry.name}: <span className="font-extrabold text-slate-900">{entry.value}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-6"><h3 className="font-black text-slate-900 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-600" /> Điểm TB Môn</h3><TrendingDown className="w-4 h-4 text-rose-500" /></div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[200px] custom-scrollbar">
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
                    <thead className="bg-slate-50/50 text-[10px] font-black text-black uppercase tracking-widest border-b">
                      <tr><th className="px-8 py-5">Học sinh</th><th className="px-8 py-5">Xếp loại</th><th className="px-8 py-5">Môn cần khắc phục</th><th className="px-8 py-5">Dự báo</th><th className="px-8 py-5 text-right no-print">Thao tác</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredStudents.sort((a,b) => (classificationPriority[a.classification] || 99) - (classificationPriority[b.classification] || 99)).map((s, idx) => (
                        <tr key={`${s.className}-${s.id}-${s.name}-${idx}`} className="hover:bg-indigo-50/30 transition-all group">
                          <td className="px-8 py-6"><div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{s.name}</div><div className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded w-fit mt-1">{s.className}</div></td>
                          <td className="px-8 py-6"><span className={`px-3 py-1 rounded-xl text-[12px] font-black border shadow-sm ${getClassificationStyles(s.classification)}`}>{s.classification}</span></td>
                          <td className="px-8 py-6">
                            {s.remedialSubjects && s.remedialSubjects.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {s.remedialSubjects.map(sub => (
                                  <span key={sub} className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-[10px] font-bold uppercase shadow-sm">
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-8 py-6"><button onClick={() => setSimulatingStudent(s)} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-all font-black text-xs border border-amber-100"><SlidersHorizontal className="w-4 h-4" /> Mô phỏng</button></td>
                          <td className="px-8 py-6 text-right no-print">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => setCommentingStudent(s)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-600 hover:text-white transition-all font-black text-xs border border-emerald-100"><PenTool className="w-4 h-4" /> Nhận xét</button>
                              <button onClick={() => setSelectedStudentForCard(s)} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all font-black text-xs border border-indigo-100"><BrainCircuit className="w-4 h-4" /> Radar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* MÔN HỌC - PHÂN LOẠI CHI TIẾT THEO LỚP */}
          {activeTab === "SUMMARY" && summaryViewMode === 'CLASS_WISE' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Thẻ KPIs thống kê lớp */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <School className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng số lớp học</p>
                    <h4 className="text-2xl font-black text-slate-900">{schoolDetailedStats.length} lớp</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Phần mềm quản lý phân lớp chuẩn</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lớp xuất sắc nhất</p>
                    <h4 className="text-2xl font-black text-emerald-600">
                      {bestClass ? bestClass.className : 'N/A'}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {bestClass 
                        ? `Lực học Tốt + Khá cao nhất, GPA: ${bestClass.avgClassScore.toFixed(2)}`
                        : "Lớp có thành tích tổng trị xuất sắc nhất"
                      }
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lớp cần quan tâm</p>
                    <h4 className="text-2xl font-black text-orange-600">
                      {targetClassToFocus ? targetClassToFocus.className : 'N/A'}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {targetClassToFocus 
                        ? `Nhiều học sinh Nguy cơ & Nguy hiểm (${targetClassToFocus.tiemCanDatCount + targetClassToFocus.chuaDatCount} HS)`
                        : schoolDetailedStats.length <= 1
                        ? "Không đủ dữ liệu so sánh (chỉ có 1 lớp)"
                        : "Không có lớp học mức nguy cơ đáng lo ngại"
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Bảng phân tích so sánh các lớp */}
              <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Ma trận phân loại học lực theo Lớp</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">So sánh tổng hợp tỷ lệ phân hạng và chất lượng giảng dạy chung.</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-black uppercase tracking-widest border-b select-none">
                      <tr>
                        <th className="px-5 py-5 text-center w-16">STT</th>
                        <th className="px-6 py-5">Tên lớp</th>
                        <th className="px-4 py-5 text-center">Sĩ số</th>
                        <th className="px-4 py-5 text-center">GPA Lớp</th>
                        <th className="px-4 py-5 text-center">Tốt</th>
                        <th className="px-4 py-5 text-center">Khá + TC Tốt</th>
                        <th className="px-4 py-5 text-center">Đạt + TC Khá & Nguy cơ</th>
                        <th className="px-4 py-5 text-center bg-rose-500/5 text-rose-700">Nguy hiểm</th>
                        <th className="px-6 py-5 text-right">Lên lớp %</th>
                        <th className="px-6 py-5 text-center no-print">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {schoolDetailedStats.map((classStat, index) => {
                        const totVal = classStat.totCount;
                        const totRate = classStat.total > 0 ? (totVal / classStat.total) * 100 : 0;
                        
                        const khaTCVal = classStat.khaCount + classStat.tiemCanTotCount;
                        const khaTCRate = classStat.total > 0 ? (khaTCVal / classStat.total) * 100 : 0;
                        
                        const datTCNewVal = classStat.datCount + classStat.tiemCanKhaCount + classStat.tiemCanDatCount;
                        const datRate = classStat.total > 0 ? (datTCNewVal / classStat.total) * 100 : 0;
                        
                        const nguyHiemRate = classStat.total > 0 ? (classStat.chuaDatCount / classStat.total) * 100 : 0;

                        return (
                          <tr key={classStat.className} className="hover:bg-indigo-50/20 transition-all font-sans font-semibold text-slate-700">
                            <td className="px-5 py-5 text-center font-extrabold text-slate-400 select-none">{index + 1}</td>
                            <td className="px-6 py-5">
                              <div className="font-extrabold text-slate-900 text-sm">{classStat.className}</div>
                              {teacherNames[classStat.className] && (
                                <div className="text-[10px] text-slate-400 font-bold mt-0.5">CN: {teacherNames[classStat.className]}</div>
                              )}
                            </td>
                            <td className="px-4 py-5 text-center font-bold text-slate-900">{classStat.total} HS</td>
                            <td className="px-4 py-5 text-center font-extrabold text-indigo-600">{classStat.avgClassScore.toFixed(2)}</td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-emerald-600 font-extrabold">{totVal}</span>
                              <span className="text-[10px] text-slate-400 block font-normal">{totRate.toFixed(0)}%</span>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-indigo-600 font-extrabold">{khaTCVal}</span>
                              <span className="text-[10px] text-slate-400 block font-normal">{khaTCRate.toFixed(0)}%</span>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-amber-600 font-extrabold">{datTCNewVal}</span>
                              <span className="text-[10px] text-slate-400 block font-normal">{datRate.toFixed(0)}%</span>
                            </td>
                            <td className="px-4 py-5 text-center bg-rose-500/5 font-extrabold text-rose-600">
                              <span>{classStat.chuaDatCount}</span>
                              <span className="text-[10px] text-rose-400 block font-normal">{nguyHiemRate.toFixed(0)}%</span>
                            </td>
                            <td className="px-6 py-5 text-right font-extrabold">
                              <span className={classStat.promotionRate >= 90 ? 'text-emerald-600' : classStat.promotionRate >= 70 ? 'text-amber-600' : 'text-rose-600'}>
                                {classStat.promotionRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center no-print">
                              <button 
                                onClick={() => setActiveTab(classStat.className)}
                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 text-[10px] font-black uppercase tracking-wider rounded-[12px] transition-all duration-300 shadow-sm border border-indigo-100"
                              >
                                Xem chi tiết
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MÔN HỌC - PHÂN LOẠI CHI TIẾT THEO MÔN */}
          {activeTab === "SUMMARY" && summaryViewMode === 'SUBJECT_WISE' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* KPIs thống kê Môn học */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng số môn phân tích</p>
                    <h4 className="text-2xl font-black text-slate-900">{subjectDetailedStats.length} môn</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Dữ liệu phân loại chi tiết</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Môn điểm trung bình cao nhất</p>
                    <h4 className="text-2xl font-black text-emerald-600">
                      {subjectDetailedStats.length > 0 ? subjectDetailedStats[0].subjectName : 'N/A'}
                    </h4>
                    <p className="text-[10px] text-emerald-400 mt-0.5">
                      Điểm TB môn đạt {subjectDetailedStats.length > 0 ? subjectDetailedStats[0].average.toFixed(2) : 0}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Môn điểm trung bình thấp nhất</p>
                    <h4 className="text-2xl font-black text-rose-600">
                      {subjectDetailedStats.length > 0 ? subjectDetailedStats[subjectDetailedStats.length - 1].subjectName : 'N/A'}
                    </h4>
                    <p className="text-[10px] text-rose-400 mt-0.5">
                      Điểm TB môn chỉ ở mức {subjectDetailedStats.length > 0 ? subjectDetailedStats[subjectDetailedStats.length - 1].average.toFixed(2) : 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bảng phân tích môn học */}
              <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Phân loại học sinh theo từng Môn học (Điểm số)</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Sắp xếp thứ tự các môn học theo hiệu quả quản lý đào tạo, phân đoạn số lượng học sinh đạt mức đánh giá TT22.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-black uppercase tracking-widest border-b select-none">
                      <tr>
                        <th className="px-6 py-5">Tên môn học</th>
                        <th className="px-6 py-5 text-center">Điểm TB môn</th>
                        <th className="px-4 py-5 text-center">Đạt mức Tốt (≥ 8.0)</th>
                        <th className="px-4 py-5 text-center">Đạt mức Khá (6.5 - 7.9)</th>
                        <th className="px-4 py-5 text-center">Đạt mức Đạt (5.0 - 6.4)</th>
                        <th className="px-4 py-5 text-center bg-rose-500/5 text-rose-700">Chưa đạt (&lt; 5.0)</th>
                        <th className="px-6 py-5">Biểu đồ lực học TB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {subjectDetailedStats.map(subStat => {
                        const totRate = subStat.total > 0 ? (subStat.totCount / subStat.total) * 100 : 0;
                        const khaRate = subStat.total > 0 ? (subStat.khaCount / subStat.total) * 100 : 0;
                        const datRate = subStat.total > 0 ? (subStat.datCount / subStat.total) * 100 : 0;
                        const chuaDatRate = subStat.total > 0 ? (subStat.chuaDatCount / subStat.total) * 100 : 0;

                        return (
                          <tr key={subStat.subjectName} className="hover:bg-indigo-50/20 transition-all font-sans font-semibold text-slate-700">
                            <td className="px-6 py-5">
                              <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-slate-400" />
                                {subStat.subjectName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-bold mt-0.5">Số lượng phân tích: {subStat.total} học sinh</div>
                            </td>
                            <td className="px-6 py-5 text-center font-extrabold text-indigo-600 text-sm">
                              {subStat.average.toFixed(2)}
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-emerald-600 font-extrabold">{subStat.totCount} HS</span>
                              <span className="text-[10px] text-slate-400 block font-normal">{totRate.toFixed(1)}%</span>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-indigo-600 font-extrabold">{subStat.khaCount} HS</span>
                              <span className="text-[10px] text-slate-400 block font-normal">{khaRate.toFixed(1)}%</span>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-amber-600 font-extrabold">{subStat.datCount} HS</span>
                              <span className="text-[10px] text-slate-400 block font-normal">{datRate.toFixed(1)}%</span>
                            </td>
                            <td className="px-4 py-5 text-center bg-rose-500/5 font-extrabold text-rose-600">
                              <span className={subStat.chuaDatCount > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}>
                                {subStat.chuaDatCount} HS
                              </span>
                              <span className="text-[10px] text-rose-400 block font-normal">{chuaDatRate.toFixed(1)}%</span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="w-40 space-y-1">
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${getAverageColor(subStat.average)}`} 
                                    style={{ width: `${subStat.average * 10}%` }}
                                  />
                                </div>
                                <div className="text-[9px] text-slate-400 text-right">TB: {subStat.average.toFixed(2)} / 10</div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TEACHER EVALUATION - ĐÁNH GIÁ CÔNG TÁC GIẢNG DẠY CỦA GIÁO VIÊN */}
          {activeTab === "SUMMARY" && summaryViewMode === 'TEACHER_WISE' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* KPIs thống kê Giáo viên */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng số Thầy Cô</p>
                    <h4 className="text-2xl font-black text-slate-900">{teacherPerformanceStats.length} giáo viên</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Đã gán trong danh sách lớp</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GV Chủ nhiệm</p>
                    <h4 className="text-2xl font-black text-slate-900">
                      {Object.keys(teacherNames).length} lớp
                    </h4>
                    <p className="text-[10px] text-emerald-500 font-bold mt-0.5">Quản lý lớp học chủ nhiệm</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GV Bộ Môn</p>
                    <h4 className="text-2xl font-black text-slate-900">
                      {Object.values(subjectTeachers).reduce((acc, obj) => acc + Object.keys(obj).length, 0)} nhiệm vụ
                    </h4>
                    <p className="text-[10px] text-blue-500 font-bold mt-0.5">Nhiệm vụ giảng dạy bộ môn</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hỗ trợ đặc biệt</p>
                    <h4 className="text-2xl font-black text-rose-600">
                      {teacherPerformanceStats.reduce((sum, t) => sum + t.totalRiskCount, 0)} lượt HS
                    </h4>
                    <p className="text-[10px] text-rose-400 font-bold mt-0.5">Điểm môn học dưới mức Đạt (&lt; 5.0)</p>
                  </div>
                </div>
              </div>

              {/* QUẢL LÝ CHỈ TIÊU & ĐỊNH MỨC XẾP LOẠI THEO MÔN */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 rounded-[40px] p-8 shadow-xl relative overflow-hidden text-white">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <SlidersHorizontal className="w-48 h-48 text-indigo-200" />
                </div>
                
                <div className="relative z-10 flex flex-col xl:flex-row gap-8 items-start xl:items-center justify-between pb-6 border-b border-white/10">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <span className="text-xs font-black uppercase tracking-widest text-amber-400">Thiết lập Chỉ tiêu linh hoạt cho các năm học</span>
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-white">Quản lý Chỉ tiêu Xếp loại theo Bộ môn</h3>
                    <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                      Thay thế cơ chế xếp loại cố định bằng hệ thống chỉ tiêu động. Thầy cô có thể tải lên tệp Excel chỉ tiêu của năm học mới, hoặc tuỳ chỉnh nhanh tỷ lệ Khá/Tốt đầu ra và yêu cầu tỷ lệ Đạt (≥ 5.0) ngay tại bảng bên dưới. Dữ liệu xếp loại giáo viên sẽ tự động cập nhật lập tức.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 shrink-0">
                    <button 
                      onClick={handleExportTargetsExcel}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/10 transition text-xs font-black flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Xuất Bản mẫu / Tải Chỉ tiêu (.xlsx)</span>
                    </button>

                    <label className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl cursor-pointer border border-indigo-500 transition text-xs font-black flex items-center gap-2">
                      <Upload className="w-4 h-4 text-white" />
                      <span>Up Chỉ Tiêu Excel (Nạp File)</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".xlsx, .xls" 
                        onChange={handleTargetsExcelUpload} 
                      />
                    </label>

                    {Object.keys(customSubjectTargets).length > 0 && (
                      <button 
                        onClick={() => {
                          if (confirm("Thầy cô có chắc chắn muốn xóa tất cả chỉ tiêu tùy chỉnh và khôi phục về cấu hình Thông tư 22 mặc định?")) {
                            setCustomSubjectTargets({});
                          }
                        }}
                        className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 rounded-2xl border border-rose-500/20 transition text-xs font-black flex items-center gap-2"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        <span>Khôi phục Mặc định</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Grid controls */}
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-indigo-200">
                      Danh sách chỉ tiêu bộ môn hiện hành ({uniqueSubjectsInSystem.length} môn & phân môn)
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold italic">
                      * Nhập trực tiếp chỉ số mới để cập nhật nhanh, hệ thống tự lưu
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[350px] overflow-y-auto rounded-3xl border border-white/5 bg-slate-950/40 backdrop-blur-md">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900/80 sticky top-0 border-b border-white/5 select-none text-[10px] uppercase font-black tracking-widest text-indigo-300">
                        <tr>
                          <th className="px-5 py-3">Môn học / Hoạt động GD</th>
                          <th className="px-5 py-3 text-center">Trạng thái</th>
                          <th className="px-5 py-3 text-center">Yêu cầu tỷ lệ Đạt (≥ 5.0) (%)</th>
                          <th className="px-5 py-3 text-center">Tỷ lệ Khá + Giỏi đạt Xuất sắc (HTXSNV) (%)</th>
                          <th className="px-5 py-3 text-center">Tỷ lệ Khá + Giỏi đạt Tốt (HTT) (%)</th>
                          <th className="px-5 py-3 text-center">Tỷ lệ Khá + Giỏi đạt Nhiệm vụ (HTNV) (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-semibold text-slate-300">
                        {uniqueSubjectsInSystem.map(subj => {
                          const t = getTargetForSubject(subj);
                          const isCustom = !!customSubjectTargets[subj];
                          return (
                            <tr key={subj} className="hover:bg-white/5 transition">
                              <td className="px-5 py-3 font-extrabold text-white">
                                {subj}
                              </td>
                              <td className="px-5 py-3 text-center">
                                {isCustom ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Tùy biến</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Mặc định</span>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex justify-center items-center">
                                  <input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={t.passRateReq}
                                    onChange={(e) => updateSubjectTarget(subj, 'passRateReq', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-20 px-2 py-1 text-center bg-slate-900 border border-white/10 rounded-lg focus:border-indigo-400 focus:outline-none text-white select-all font-black text-xs"
                                  />
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex justify-center items-center">
                                  <input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={t.htxsnvRate}
                                    onChange={(e) => updateSubjectTarget(subj, 'htxsnvRate', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-20 px-2 py-1 text-center bg-slate-900 border border-white/10 rounded-lg focus:border-indigo-400 focus:outline-none text-white select-all font-black text-xs"
                                  />
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex justify-center items-center">
                                  <input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={t.httRate}
                                    onChange={(e) => updateSubjectTarget(subj, 'httRate', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-20 px-2 py-1 text-center bg-slate-900 border border-white/10 rounded-lg focus:border-indigo-400 focus:outline-none text-white select-all font-black text-xs"
                                  />
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex justify-center items-center">
                                  <input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={t.htnvRate}
                                    onChange={(e) => updateSubjectTarget(subj, 'htnvRate', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-20 px-2 py-1 text-center bg-slate-900 border border-white/10 rounded-lg focus:border-indigo-400 focus:outline-none text-white select-all font-black text-xs"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Phân tích Chi tiết từng Giáo viên */}
              <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Mặt bằng Hiệu Học & Phân Phối Kết Quả Giảng Dạy</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-1">
                    Bảng so sánh năng lượng truyền tải, điểm trung bình đầu ra, tỉ lệ tốt - khá của các lớp theo từng giáo viên được phân giao.
                  </p>
                </div>

                {teacherPerformanceStats.length === 0 ? (
                  <div className="p-16 text-center text-slate-400">
                    <UserCheck className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-sm font-extrabold text-slate-700">Chưa có thông tin phân công giáo viên chủ nhiệm & bộ môn.</p>
                    <p className="text-xs text-slate-400 mt-2">Dùng nút "Nạp PC Giáo Viên" màu xanh ở góc phải trên cùng để tải dữ liệu phân vai của thầy cô, hoặc gán thủ công bằng tay ở cột trái lớp học.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-black uppercase tracking-widest border-b select-none">
                        <tr>
                          <th className="px-6 py-5">Tên Giáo viên</th>
                          <th className="px-6 py-5">Nhiệm vụ Phân công</th>
                          <th className="px-6 py-5 text-center">Sĩ số dạy</th>
                          <th className="px-6 py-5 text-center">Điểm TB môn dạy</th>
                          <th className="px-6 py-5 text-center">% Khá + Giỏi (≥ 6.5)</th>
                          <th className="px-6 py-5 text-center text-rose-700 bg-rose-500/5">Yếu kém (&lt; 5.0)</th>
                          <th className="px-6 py-5">Đánh giá / Điều phối Sư phạm (Ban Giám Hiệu gợi ý)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                        {teacherPerformanceStats.sort((a,b) => b.overallSubjectGpa - a.overallSubjectGpa).map((tc, idx) => {
                          const hasSubject = tc.subjectMetrics.length > 0;
                          
                          let remark = "Tham gia giữ vai trò sư phạm hỗ trợ lớp học.";
                          let remarkColor = "text-slate-500 bg-slate-50";

                          if (hasSubject) {
                            if (tc.overallSubjectGpa >= 8.0 && tc.overallSubjectGoodAndFairRate >= 80) {
                              remark = "Dạy học xuất sắc! Chất lượng đồng đều, tỉ lệ bứt phá cao.";
                              remarkColor = "text-emerald-700 bg-emerald-50 border border-emerald-100/50";
                            } else if (tc.overallSubjectGpa >= 6.5 && tc.overallSubjectRiskRate < 15) {
                              remark = "Chất lượng dạy học đại trà tốt, giữ lớp ổn định, ít có học sinh nguy cơ.";
                              remarkColor = "text-indigo-700 bg-indigo-50 border border-indigo-100/50";
                            } else if (tc.overallSubjectRiskRate >= 25 || tc.overallSubjectGpa < 5.0) {
                              remark = "Kiểm soát an toàn chưa tốt. Giáo viên bộ môn cần họp cùng GVCN để phụ đạo và kèm cặp thêm.";
                              remarkColor = "text-rose-700 bg-rose-50 border border-rose-100/50";
                            } else {
                              remark = "Năng lực ổn định, đáp ứng tốt khung chuẩn chương trình môn học.";
                              remarkColor = "text-amber-700 bg-amber-50 border border-amber-100/50";
                            }
                          } else if (tc.gvcnMetrics.length > 0) {
                            const mainClass = tc.gvcnMetrics[0];
                            if (mainClass.gpa >= 7.8) {
                              remark = "Chủ nhiệm xuất sắc! Tập thể đoàn kết, tự học cao, tỷ lệ khá giỏi cao.";
                              remarkColor = "text-emerald-700 bg-emerald-50 border border-emerald-100/50";
                            } else if (mainClass.riskRate > 25) {
                              remark = "Lớp có nhiều yếu tố rủi ro rèn luyện. Cần phối hợp giáo viên bộ môn tăng cường giám sát.";
                              remarkColor = "text-rose-700 bg-rose-50 border border-rose-100/50";
                            } else {
                              remark = "Lớp chủ nhiệm hoạt động nề nếp, kết quả chuyển giao học tập tương đối ổn định.";
                              remarkColor = "text-slate-700 bg-slate-50 border border-slate-100";
                            }
                          }

                          // Construct roles list
                          const roles = [
                            ...tc.gvcnClasses.map(cls => {
                              const metric = tc.gvcnMetrics.find(m => m.className === cls);
                              return { type: 'GVCN' as const, name: cls, displayName: `🎓 GVCN: ${cls}`, metric };
                            }),
                            ...tc.subjectClasses.map(sc => {
                              const metric = tc.subjectMetrics.find(m => m.className === sc.className && m.subjectName === sc.subjectName);
                              return { type: 'Subject' as const, name: sc.className, displayName: `📚 ${sc.subjectName} (${sc.className})`, metric };
                            })
                          ];

                          return (
                            <tr key={tc.name} className="hover:bg-indigo-50/10 transition-all font-sans font-semibold text-slate-700">
                              <td className="px-6 py-5 align-top">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-sm">
                                    {tc.name.split(" ").pop()?.split("")[0] || "GV"}
                                  </div>
                                  <div>
                                    <div className="text-sm font-extrabold text-slate-900">{tc.name}</div>
                                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">Số thứ tự: {idx+1}</div>
                                  </div>
                                </div>
                              </td>
                              
                              {/* Duties by Class */}
                              <td className="px-6 py-5 align-top">
                                <div className="flex flex-col divide-y divide-slate-100">
                                  {roles.map((role, rIdx) => (
                                    <div key={rIdx} className="py-2.5 first:pt-0 last:pb-0 min-h-[52px] flex items-center">
                                      {role.type === 'GVCN' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-black uppercase">
                                          {role.displayName}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[10px] font-black uppercase">
                                          {role.displayName}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                  {roles.length === 0 && (
                                    <span className="text-slate-400 text-xs italic font-normal py-2.5">Chưa gán</span>
                                  )}
                                </div>
                              </td>

                              {/* Student Count by Class */}
                              <td className="px-6 py-5 align-top text-center">
                                <div className="flex flex-col divide-y divide-slate-100">
                                  {roles.map((role, rIdx) => (
                                    <div key={rIdx} className="py-2.5 first:pt-0 last:pb-0 min-h-[52px] flex items-center justify-center font-black text-slate-800">
                                      {role.metric ? `${role.metric.total} HS` : <span className="text-slate-400 font-normal italic">Chưa có HS</span>}
                                    </div>
                                  ))}
                                  {roles.length === 0 && "-"}
                                </div>
                              </td>

                              {/* Average GPA by Class */}
                              <td className="px-6 py-5 align-top text-center">
                                <div className="flex flex-col divide-y divide-slate-100">
                                  {roles.map((role, rIdx) => {
                                    const m = role.metric;
                                    const label = role.type === 'GVCN' ? 'TB Học sinh' : 'TB Môn';
                                    return (
                                      <div key={rIdx} className="py-2.5 first:pt-0 last:pb-0 min-h-[52px] flex flex-col items-center justify-center">
                                        {m ? (
                                          <>
                                            <span className="font-extrabold text-indigo-600 text-sm">{m.gpa.toFixed(2)}</span>
                                            <span className="text-[9px] text-slate-400 font-bold block">{label}</span>
                                          </>
                                        ) : (
                                          <span className="text-slate-400 font-normal italic">-</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {roles.length === 0 && "-"}
                                </div>
                              </td>

                              {/* Good/Fair (>= 6.5) Rate by Class */}
                              <td className="px-6 py-5 align-top text-center">
                                <div className="flex flex-col divide-y divide-slate-100">
                                  {roles.map((role, rIdx) => {
                                    const m = role.metric;
                                    const subLabel = role.type === 'GVCN' ? 'Mặt bằng lớp' : 'Môn dạy';
                                    return (
                                      <div key={rIdx} className="py-2.5 first:pt-0 last:pb-0 min-h-[52px] flex flex-col justify-center items-center">
                                        {m ? (
                                          <>
                                            <span className="font-extrabold text-emerald-600">{m.goodAndFairRate.toFixed(1)}%</span>
                                            <span className="text-[9px] text-slate-400 font-bold block">({subLabel})</span>
                                          </>
                                        ) : (
                                          <span className="text-slate-400 font-normal italic">-</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {roles.length === 0 && "-"}
                                </div>
                              </td>

                              {/* Risk/Failed Rate by Class */}
                              <td className="px-6 py-5 align-top text-center bg-rose-500/5">
                                <div className="flex flex-col divide-y divide-slate-100">
                                  {roles.map((role, rIdx) => {
                                    const m = role.metric;
                                    return (
                                      <div key={rIdx} className="py-2.5 first:pt-0 last:pb-0 min-h-[52px] flex flex-col justify-center items-center">
                                        {m ? (
                                          <span className={`font-extrabold ${m.riskCount > 0 ? "text-rose-600 font-black bg-rose-50 px-1.5 py-0.5 rounded-lg border border-rose-150" : "text-slate-400 font-normal"}`}>
                                            {m.riskCount} HS ({m.riskRate.toFixed(1)}%)
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 font-normal italic">-</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {roles.length === 0 && "-"}
                                </div>
                              </td>

                              {/* Principal evaluations & suggestions */}
                              <td className="px-6 py-5 align-top">
                                <div className="flex flex-col divide-y divide-slate-100">
                                  {roles.map((role, rIdx) => {
                                    const m = role.metric;
                                    const label = role.type === 'GVCN' ? 'Chủ nhiệm' : 'Dạy môn';
                                    
                                    if (!m) {
                                      return (
                                        <div key={rIdx} className="py-2.5 first:pt-0 last:pb-0 min-h-[52px] flex flex-col justify-center gap-1">
                                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-tight">
                                            {label} lớp {role.name}
                                          </span>
                                          <span className="text-slate-400 font-normal italic text-[10px]">Chưa có dữ liệu HS</span>
                                        </div>
                                      );
                                    }

                                    let badgeStyle = "text-slate-600 bg-slate-50 border border-slate-200";
                                    if (m.principalRating.includes("HTXSNV")) {
                                      badgeStyle = "text-emerald-700 bg-emerald-50 border border-emerald-250 shadow-sm font-black";
                                    } else if (m.principalRating.includes("HTT")) {
                                      badgeStyle = "text-blue-700 bg-blue-50 border border-blue-250 shadow-sm font-bold";
                                    } else if (m.principalRating.includes("HTNV")) {
                                      badgeStyle = "text-amber-750 bg-amber-50 border border-amber-250 shadow-sm font-semibold";
                                    } else if (m.principalRating.includes("KHTNV")) {
                                      badgeStyle = "text-rose-700 bg-rose-50 border border-rose-250 shadow-sm font-black animate-pulse";
                                    }

                                    return (
                                      <div key={rIdx} className="py-2.5 first:pt-0 last:pb-0 min-h-[52px] flex flex-col justify-center gap-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-wide inline-block ${badgeStyle}`}>
                                            {m.principalRating}
                                          </span>
                                        </div>
                                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-tight">
                                          {label} lớp {role.name}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {roles.length === 0 && <span className="text-slate-400 text-xs italic">-</span>}
                                  
                                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-1.5 mt-2">
                                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Hạ tầng phân tích chung:</span>
                                    <span className={`px-3 py-2 rounded-xl text-[11px] font-bold block leading-relaxed ${remarkColor}`}>
                                      {remark}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
        </main>
      </div>
      <footer className="bg-slate-50 border-t p-6 no-print">
         <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-slate-400 text-xs font-semibold">
               {APP_NAME} - {APP_SUBTITLE}
            </div>
            <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2">
               <span>Bản quyền Edulab Ai 2026</span>
               <span className="text-slate-300">|</span>
               <span className="text-indigo-600 font-extrabold">Hotline: 0989550411</span>
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
