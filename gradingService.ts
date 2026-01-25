
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

export const calculateClassificationAndGoals = (scores: SubjectScore[]) => {
  const count8 = scores.filter(s => s.score >= 8.0).length;
  const count65 = scores.filter(s => s.score >= 6.5).length;
  const count50 = scores.filter(s => s.score >= 5.0).length;
  const minScore = scores.length > 0 ? Math.min(...scores.map(s => s.score)) : 0;
  
  const countUnder65 = scores.filter(s => s.score < 6.5).length;
  const countUnder50 = scores.filter(s => s.score < 5.0).length;
  const hasBetween35And40 = scores.some(s => s.score >= 3.5 && s.score < 4.0);
  
  let classification: StudentClassification = StudentClassification.CHUA_DAT;

  // Thuật toán ưu tiên từ cao xuống thấp
  // 1. Loại Tốt
  if (minScore >= 6.5 && count8 >= 6) {
    classification = StudentClassification.TOT;
  }
  // 2. Tiệm cận Tốt
  else if ((count8 >= 4 && count8 <= 5 && minScore >= 6.5) || (count8 >= 6 && countUnder65 === 1)) {
    classification = StudentClassification.TIEM_CAN_TOT;
  }
  // 3. Loại Khá
  else if (minScore >= 5.0 && count65 >= 6) {
    classification = StudentClassification.KHA;
  }
  // 4. Tiệm cận Khá
  else if ((count65 >= 4 && count65 <= 5 && minScore >= 5.0) || (count65 >= 6 && countUnder50 === 1)) {
    classification = StudentClassification.TIEM_CAN_KHA;
  }
  // 5. Loại Đạt (Điều kiện: không môn nào dưới 3.5 và ít nhất 6 môn >= 5.0)
  // Lưu ý: Nếu rơi vào trường hợp "chỉ có đúng 6 môn >= 5.0" thì sẽ xuống Tiệm cận Đạt ở bước 6
  else if (minScore >= 3.5 && count50 > 6) {
    classification = StudentClassification.DAT;
  }
  // 6. Tiệm cận Đạt
  else if (minScore >= 3.5 && (hasBetween35And40 || count50 === 6)) {
    classification = StudentClassification.TIEM_CAN_DAT;
  }
  // 7. Chưa đạt
  else {
    classification = StudentClassification.CHUA_DAT;
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

  return { classification, goals };
};

export const processRawStudentData = (
  raw: any, 
  subjectHeaders: string[],
  keys: { nameKey: string; classKey: string; sttKey: string }
): StudentData | null => {
  try {
    const name = String(raw[keys.nameKey] || '').trim();
    if (!name || name.toLowerCase() === 'họ tên' || name.length < 2) return null;

    let hasValidScore = false;
    const scores: SubjectScore[] = subjectHeaders.map(header => {
      const val = raw[header];
      let score = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(score)) return { name: header, score: -1, level: SubjectLevel.CHUA_DAT };
      hasValidScore = true;
      return { name: header, score, level: getSubjectLevel(score) };
    }).filter(s => s.score !== -1);

    if (!hasValidScore || scores.length === 0) return null;

    const { classification, goals } = calculateClassificationAndGoals(scores);
    const className = String(raw[keys.classKey] || 'Chưa rõ').trim();
    const idValue = parseInt(raw[keys.sttKey]);

    return {
      id: isNaN(idValue) ? Math.floor(Math.random() * 1000000) : idValue,
      name,
      className,
      scores,
      classification,
      summary: goals.length > 0 ? `Cần cải thiện ${goals.length} môn.` : "Ổn định.",
      goals,
      prioritySubjects: goals.map(g => g.subjectName)
    };
  } catch (err) { return null; }
};
