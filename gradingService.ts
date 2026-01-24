
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

    const totCount = scores.filter(s => s.score >= 8.0).length;
    const khaPlusCount = scores.filter(s => s.score >= 6.5).length;
    const minScore = Math.min(...scores.map(s => s.score));
    
    let classification: StudentClassification = StudentClassification.DAT;
    let goals: Goal[] = [];

    // --- LOGIC TẠO MỤC TIÊU THEO YÊU CẦU ĐIỀU CHỈNH ---
    scores.forEach(s => {
      // 1. Từ 7.5 -> Phấn đấu lên 8.0
      if (s.score >= 7.5 && s.score < 8.0) {
        goals.push({
          subjectName: s.name,
          currentScore: s.score,
          targetScore: 8.0,
          increment: 8.0 - s.score,
          description: "Phấn đấu lên 8.0"
        });
      }
      // 2. Từ 6.0 -> Phấn đấu lên 6.5
      else if (s.score >= 6.0 && s.score < 6.5) {
        goals.push({
          subjectName: s.name,
          currentScore: s.score,
          targetScore: 6.5,
          increment: 6.5 - s.score,
          description: "Phấn đấu lên 6.5"
        });
      }
      // 3. Từ 3.5 -> Phấn đấu lên 5.0
      else if (s.score >= 3.5 && s.score < 5.0) {
        goals.push({
          subjectName: s.name,
          currentScore: s.score,
          targetScore: 5.0,
          increment: 5.0 - s.score,
          description: "Phấn đấu lên 5.0"
        });
      }
    });

    // --- PHÂN LOẠI TT22 ---
    if (minScore < 5.0) {
      classification = StudentClassification.NGUY_CO;
    } else if (totCount >= 6 && minScore >= 6.5) {
      classification = StudentClassification.TOT;
    } else if ((totCount === 5 && minScore >= 6.5) || (totCount >= 6 && minScore < 6.5)) {
      classification = StudentClassification.TIEM_CAN_TOT;
    } else if (minScore >= 5.0 && khaPlusCount >= 6) {
      classification = StudentClassification.KHA;
    } else {
      classification = StudentClassification.DAT;
    }

    const summary = goals.length > 0 
      ? `Cần phấn đấu cải thiện ${goals.length} môn để đạt mục tiêu cao hơn.` 
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
