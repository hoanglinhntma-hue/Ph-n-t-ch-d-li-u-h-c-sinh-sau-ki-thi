
import { SubjectLevel, StudentClassification, SubjectScore, StudentData, Goal } from './types';

export const getSubjectLevel = (score: number): SubjectLevel => {
  if (score >= 8.0) return SubjectLevel.TOT;
  if (score >= 6.5) return SubjectLevel.KHA;
  if (score >= 5.0) return SubjectLevel.DAT;
  return SubjectLevel.CHUA_DAT;
};

export const processRawStudentData = (
  raw: any, 
  subjectHeaders: string[],
  keys: { nameKey: string; classKey: string; sttKey: string }
): StudentData | null => {
  try {
    const name = String(raw[keys.nameKey] || '').trim();
    if (!name || name.toLowerCase() === 'họ tên' || name.length < 2) {
      return null;
    }

    let hasValidScore = false;
    const scores: SubjectScore[] = subjectHeaders.map(header => {
      const val = raw[header];
      let score = typeof val === 'number' ? val : parseFloat(val);
      
      if (isNaN(score)) {
        return { name: header, score: -1, level: SubjectLevel.CHUA_DAT };
      }
      
      hasValidScore = true;
      return {
        name: header,
        score,
        level: getSubjectLevel(score)
      };
    }).filter(s => s.score !== -1);

    if (!hasValidScore || scores.length === 0) {
      return null;
    }

    const count8 = scores.filter(s => s.score >= 8.0).length;
    const count65 = scores.filter(s => s.score >= 6.5).length;
    const count50 = scores.filter(s => s.score >= 5.0).length;
    const minScore = Math.min(...scores.map(s => s.score));
    const countUnder65 = scores.filter(s => s.score < 6.5).length;
    const countUnder50 = scores.filter(s => s.score < 5.0).length;
    const hasBetween35And40 = scores.some(s => s.score >= 3.5 && s.score < 4.0);
    
    let classification: StudentClassification = StudentClassification.CHUA_DAT;

    // --- LOGIC PHÂN LOẠI MỚI ---
    
    // 1. TỐT
    if (minScore >= 6.5 && count8 >= 6) {
      classification = StudentClassification.TOT;
    }
    // 2. TIỆM CẬN TỐT
    else if ((count8 >= 4 && count8 <= 5) || (count8 >= 6 && countUnder65 === 1)) {
      classification = StudentClassification.TIEM_CAN_TOT;
    }
    // 3. KHÁ
    else if (minScore >= 5.0 && count65 >= 6) {
      classification = StudentClassification.KHA;
    }
    // 4. TIỆM CẬN KHÁ
    else if ((count65 >= 4 && count65 <= 5) || (count65 >= 6 && countUnder50 === 1)) {
      classification = StudentClassification.TIEM_CAN_KHA;
    }
    // 5. CHƯA ĐẠT (Kiểm tra sớm để loại trừ các mức thấp nhất)
    else if (minScore < 3.5 || count50 < 6) {
      classification = StudentClassification.CHUA_DAT;
    }
    // 6. TIỆM CẬN ĐẠT
    else if (hasBetween35And40 || count50 === 6) {
      classification = StudentClassification.TIEM_CAN_DAT;
    }
    // 7. ĐẠT
    else {
      classification = StudentClassification.DAT;
    }

    // --- LOGIC TẠO MỤC TIÊU ---
    let goals: Goal[] = [];
    scores.forEach(s => {
      if (s.score >= 7.5 && s.score < 8.0) {
        goals.push({
          subjectName: s.name, currentScore: s.score, targetScore: 8.0, increment: 8.0 - s.score,
          description: "Phấn đấu lên 8.0"
        });
      } else if (s.score >= 6.0 && s.score < 6.5) {
        goals.push({
          subjectName: s.name, currentScore: s.score, targetScore: 6.5, increment: 6.5 - s.score,
          description: "Phấn đấu lên 6.5"
        });
      } else if (s.score >= 3.5 && s.score < 5.0) {
        goals.push({
          subjectName: s.name, currentScore: s.score, targetScore: 5.0, increment: 5.0 - s.score,
          description: "Phấn đấu lên 5.0"
        });
      }
    });

    const summary = goals.length > 0 
      ? `Cần phấn đấu cải thiện ${goals.length} môn trọng điểm.` 
      : (classification === StudentClassification.TOT ? "Duy trì phong độ Tốt." : "Học lực ổn định.");

    const className = String(raw[keys.classKey] || 'Chưa rõ').trim();
    const idValue = parseInt(raw[keys.sttKey]);

    return {
      id: isNaN(idValue) ? Math.floor(Math.random() * 1000000) : idValue,
      name,
      className,
      scores,
      classification,
      summary,
      goals,
      prioritySubjects: goals.map(g => g.subjectName)
    };
  } catch (err) {
    return null;
  }
};
