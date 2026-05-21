
import { SubjectLevel, StudentClassification, SubjectScore, StudentData, Goal } from './types';

export const getSubjectLevel = (score: number): SubjectLevel => {
  if (score >= 8.0) return SubjectLevel.TOT;
  if (score >= 6.5) return SubjectLevel.KHA;
  if (score >= 5.0) return SubjectLevel.DAT;
  return SubjectLevel.CHUA_DAT;
};

export const getRadarData = (scores: SubjectScore[]) => {
  return scores.map(s => ({
    subject: s.name,
    A: s.score,
    label: `${s.name}: ${s.score.toFixed(1)}`,
    fullMark: 10
  }));
};

export const calculateClassificationAndGoals = (
  scores: SubjectScore[],
  conduct: string = "Tốt",
  absencesTotal: number = 0,
  absencesExcused: number = 0,
  absencesUnexcused: number = 0
) => {
  const Count_8 = scores.filter(s => s.score >= 8.0).length;
  const Count_65 = scores.filter(s => s.score >= 6.5).length;
  const Count_5 = scores.filter(s => s.score >= 5.0).length;
  const Min_Score = scores.length > 0 ? Math.min(...scores.map(s => s.score)) : 0;
  
  const Count_Under_65 = scores.filter(s => s.score < 6.5).length;
  const Count_Under_5 = scores.filter(s => s.score < 5.0).length;
  
  let classification: StudentClassification = StudentClassification.CHUA_DAT;

  // BƯỚC 1: XÉT NHÓM TỐT VÀ TIỆM CẬN TỐT
  if (Count_8 >= 6 && Min_Score >= 6.5) {
    classification = StudentClassification.TOT;
  }
  else if (((Count_8 === 4 || Count_8 === 5) && Min_Score >= 6.5) || (Count_8 >= 6 && Count_Under_65 === 1)) {
    classification = StudentClassification.TIEM_CAN_TOT;
  }
  // BƯỚC 2: XÉT NHÓM KHÁ VÀ TIỆM CẬN KHÁ
  else if (Count_65 >= 6 && Min_Score >= 5.0) {
    classification = StudentClassification.KHA;
  }
  else if (((Count_65 === 4 || Count_65 === 5) && Min_Score >= 5.0) || (Count_65 >= 6 && Count_Under_5 === 1)) {
    classification = StudentClassification.TIEM_CAN_KHA;
  }
  // BƯỚC 3: XÉT NHÓM ĐẠT VÀ TIỆM CẬN ĐẠT
  else if (Count_5 >= 6 && Min_Score >= 3.5) {
    if (Count_5 === 6 || Min_Score < 4.0) {
      classification = StudentClassification.TIEM_CAN_DAT;
    } else {
      classification = StudentClassification.DAT;
    }
  }
  // BƯỚC 4: NHÓM CHƯA ĐẠT
  else {
    classification = StudentClassification.CHUA_DAT;
  }

  // Môn cần khắc phục dựa trên loại tiệm cận và phân loại hiện tại để phục vụ mục tiêu thi đua bứt phá
  let remedialSubjects: string[] = [];
  if (classification === StudentClassification.TOT) {
    remedialSubjects = scores.filter(s => s.score < 8.0).map(s => s.name);
  } else if (classification === StudentClassification.TIEM_CAN_TOT) {
    remedialSubjects = scores.filter(s => s.score < 8.0).map(s => s.name);
  } else if (classification === StudentClassification.KHA) {
    remedialSubjects = scores.filter(s => s.score < 6.5).map(s => s.name);
  } else if (classification === StudentClassification.TIEM_CAN_KHA) {
    remedialSubjects = scores.filter(s => s.score < 6.5).map(s => s.name);
  } else {
    // DAT, TIEM_CAN_DAT, CHUA_DAT
    remedialSubjects = scores.filter(s => s.score < 5.0).map(s => s.name);
    // Nếu rỗng, lấy thêm các môn rớt hoặc điểm rèn luyện thấp nhất để gợi ý định hướng
    if (remedialSubjects.length === 0) {
      remedialSubjects = scores.filter(s => s.score === Min_Score).map(s => s.name);
    }
  }

  // 2. BỔ SUNG LOGIC DANH HIỆU KHEN THƯỞNG (ĐIỀU 15 TT22)
  const isAcademicTot = classification === StudentClassification.TOT;
  const isConductTot = conduct === "Tốt";
  let merit: string | null = null;
  if (isAcademicTot && isConductTot) {
    const count9 = scores.filter(s => s.score >= 9.0).length;
    if (count9 >= 6) {
      merit = "Học sinh Xuất sắc";
    } else {
      merit = "Học sinh Giỏi";
    }
  }

  // 3. HỆ THỐNG CẢNH BÁO TỬ VONG/CHUYÊN CẦN VÀ RÈN LUYỆN (ĐIỀU 12 TT22)
  const alerts: string[] = [];
  if (absencesTotal > 45) {
    alerts.push("Nguy cơ ở lại lớp do nghỉ và vắng quá 45 buổi");
  }
  if (absencesExcused > 30) {
    alerts.push(`Cảnh báo nghỉ học có phép nhiều (${absencesExcused} buổi > 30)`);
  }
  if (absencesUnexcused >= 1) {
    alerts.push(`Cảnh báo nghỉ học không phép (${absencesUnexcused} buổi)`);
  }
  if (conduct === "Chưa đạt") {
    alerts.push("Cần rèn luyện thêm trong kì nghỉ hè");
  }

  // ĐIỀU KIỆN ĐƯỢC LÊN LỚP (ĐIỀU 12 TT22)
  const isAcademicPromotion = [
    StudentClassification.TOT,
    StudentClassification.TIEM_CAN_TOT,
    StudentClassification.KHA,
    StudentClassification.TIEM_CAN_KHA,
    StudentClassification.DAT,
    StudentClassification.TIEM_CAN_DAT
  ].includes(classification);

  const isConductPromotion = ["Tốt", "Khá", "Đạt"].includes(conduct);
  const isAbsencePromotion = absencesTotal <= 45;

  let promotionStatus = "Chưa đạt chuẩn lên lớp";
  if (absencesTotal > 45) {
    promotionStatus = "Không được lên lớp (nghỉ quá 45 buổi)";
  } else if (conduct === "Chưa đạt") {
    promotionStatus = "Phải rèn luyện thêm trong kì nghỉ hè";
  } else if (!isAcademicPromotion) {
    promotionStatus = "Phải kiểm tra lại môn học hoặc rèn luyện thêm";
  } else if (isAcademicPromotion && isConductPromotion && isAbsencePromotion) {
    promotionStatus = "Đủ điều kiện lên lớp";
  }

  // Logic đề xuất mục tiêu - Chú ý ngưỡng khả quan +0.5
  let goals: Goal[] = [];
  scores.forEach(s => {
    // Tìm các môn có thể bứt phá lên ngưỡng kế tiếp với mức tăng tối thiểu
    let target = -1;
    if (s.score >= 7.5 && s.score < 8.0) target = 8.0;
    else if (s.score >= 6.0 && s.score < 6.5) target = 6.5;
    else if (s.score >= 4.5 && s.score < 5.0) target = 5.0;
    else if (s.score >= 3.0 && s.score < 3.5) target = 3.5;

    if (target !== -1) {
      const inc = target - s.score;
      goals.push({
        subjectName: s.name,
        currentScore: s.score,
        targetScore: target,
        increment: inc,
        description: inc <= 0.5 ? "Mục tiêu khả quan (+0.5)" : "Mục tiêu thách thức (>0.5)"
      });
    }
  });

  return { classification, goals, remedialSubjects, merit, promotionStatus, alerts };
};

export const processRawStudentData = (
  raw: any, 
  subjectHeaders: string[],
  keys: { 
    nameKey: string; 
    classKey: string; 
    sttKey: string;
    conductKey?: string;
    absencesExKey?: string;
    absencesUnexKey?: string;
    absencesTongKey?: string;
    noteKey?: string;
  }
): StudentData | null => {
  try {
    const name = String(raw[keys.nameKey] || '').trim().replace(/\s+/g, ' ');
    if (!name || name.toLowerCase() === 'họ tên' || name.length < 1) return null;

    let hasValidScore = false;
    const scores: SubjectScore[] = subjectHeaders.map(header => {
      const val = raw[header];
      let score = typeof val === 'number' ? val : parseFloat(String(val || '').replace(',', '.'));
      if (isNaN(score)) return { name: header, score: -1, level: SubjectLevel.CHUA_DAT };
      hasValidScore = true;
      return { name: header, score, level: getSubjectLevel(score) };
    }).filter(s => s.score !== -1);

    if (!hasValidScore || scores.length === 0) return null;

    // Xử lý Hạnh kiểm (Kết quả rèn luyện)
    let conduct = "Tốt";
    if (keys.conductKey && raw[keys.conductKey] !== undefined) {
      const condVal = String(raw[keys.conductKey]).trim().toLowerCase();
      if (condVal.includes("chưa đạt") || condVal.includes("chua dat") || condVal === "cd") {
        conduct = "Chưa đạt";
      } else if (condVal.includes("khá") || condVal.includes("kha") || condVal === "k") {
        conduct = "Khá";
      } else if (condVal.includes("đạt") || condVal.includes("dat") || condVal === "đ" || condVal === "d") {
        conduct = "Đạt";
      } else if (condVal.includes("tốt") || condVal.includes("tot") || condVal === "t") {
        conduct = "Tốt";
      }
    }

    const parseNumber = (val: any): number => {
      if (typeof val === 'number') return val;
      const parsed = parseFloat(String(val || '0').trim().replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    };

    const absencesExcused = keys.absencesExKey ? parseNumber(raw[keys.absencesExKey]) : 0;
    const absencesUnexcused = keys.absencesUnexKey ? parseNumber(raw[keys.absencesUnexKey]) : 0;
    let absencesTotal = keys.absencesTongKey ? parseNumber(raw[keys.absencesTongKey]) : 0;

    // Nếu nghỉ tổng chưa có nhưng có nghỉ P hoặc K, thì cộng lại
    if (absencesTotal === 0 && (absencesExcused > 0 || absencesUnexcused > 0)) {
      absencesTotal = absencesExcused + absencesUnexcused;
    }

    const note = keys.noteKey ? String(raw[keys.noteKey] || '').trim() : '';
    // Nếu trong ghi chú có từ khóa "phải rèn luyện" hoặc "yếu rèn luyện" thì rèn luyện là Chưa đạt
    if (note.toLowerCase().includes("rèn luyện") && note.toLowerCase().includes("phải")) {
      conduct = "Chưa đạt";
    }

    const { classification, goals, remedialSubjects, merit, promotionStatus, alerts } = 
      calculateClassificationAndGoals(scores, conduct, absencesTotal, absencesExcused, absencesUnexcused);

    const className = String(raw[keys.classKey] || 'Chưa rõ').trim();
    const idValue = parseInt(raw[keys.sttKey]);
    const fallbackId = raw._rowIndex !== undefined ? raw._rowIndex : Math.floor(Math.random() * 1000000);

    return {
      id: isNaN(idValue) ? fallbackId : idValue,
      name,
      className,
      scores,
      classification,
      summary: goals.length > 0 ? `Cần cải thiện ${goals.length} môn.` : "Ổn định.",
      goals,
      prioritySubjects: goals.map(g => g.subjectName),
      remedialSubjects,
      conduct,
      absencesExcused,
      absencesUnexcused,
      absencesTotal,
      note,
      merit,
      promotionStatus,
      alerts
    };
  } catch (err) { return null; }
};
