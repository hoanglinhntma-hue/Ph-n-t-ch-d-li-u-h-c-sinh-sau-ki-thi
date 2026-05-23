
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

export const getAcademicLevel = (classification: StudentClassification): string => {
  if (classification === StudentClassification.TOT) {
    return 'Tốt';
  }
  if (
    classification === StudentClassification.TIEM_CAN_TOT ||
    classification === StudentClassification.KHA
  ) {
    return 'Khá';
  }
  if (
    classification === StudentClassification.TIEM_CAN_KHA ||
    classification === StudentClassification.DAT ||
    classification === StudentClassification.TIEM_CAN_DAT
  ) {
    return 'Đạt';
  }
  return 'Chưa đạt';
};

export const getCombinedComments = (academic: string, conduct: string, name: string): string[] => {
  const repl = (txt: string) => txt.replace(/\{name\}/g, name);

  // 1. Tốt - Tốt
  if (academic === 'Tốt' && conduct === 'Tốt') {
    return [
      `Em {name} có kết quả học tập và rèn luyện nổi bật. Em chăm chỉ, tự giác trong học tập, có tinh thần trách nhiệm, biết hợp tác và hỗ trợ bạn bè trong các hoạt động chung.`,
      `Em {name} tiếp thu bài nhanh, tư duy tốt, trình bày bài rõ ràng, khoa học. Em lễ phép, trung thực, có ý thức kỷ luật tốt và tích cực tham gia các hoạt động của lớp.`,
      `Em {name} luôn chủ động trong học tập, biết tự học và vận dụng kiến thức vào giải quyết nhiệm vụ. Em cần tiếp tục phát huy tinh thần sáng tạo, tự tin chia sẻ ý kiến để đạt kết quả cao hơn.`
    ].map(repl);
  }

  // 2. Tốt - Khá
  if (academic === 'Tốt' && conduct === 'Khá') {
    return [
      `Em {name} có kết quả học tập tốt, tiếp thu kiến thức nhanh và hoàn thành tốt các nhiệm vụ học tập. Em cần tích cực hơn trong sinh hoạt tập thể và rèn luyện thêm tính chủ động khi tham gia hoạt động chung.`,
      `Em {name} có năng lực tự học tốt, tư duy rõ ràng, biết vận dụng kiến thức vào bài làm. Em cần chú ý hơn đến nề nếp, tác phong và tinh thần hợp tác với bạn bè.`,
      `Em {name} đạt kết quả học tập nổi bật, có ý thức phấn đấu trong học tập. Em nên rèn luyện thêm kỹ năng giao tiếp, hợp tác và tham gia tích cực hơn vào các hoạt động của lớp.`
    ].map(repl);
  }

  // 3. Tốt - Đạt
  if (academic === 'Tốt' && conduct === 'Đạt') {
    return [
      `Em {name} có khả năng học tập tốt, tiếp thu bài nhanh và hoàn thành tốt yêu cầu của các môn học. Em cần nghiêm túc hơn trong việc thực hiện nội quy, rèn luyện tác phong học tập và sinh hoạt tập thể.`,
      `Em {name} có nền tảng kiến thức vững, biết tự học và có khả năng giải quyết nhiệm vụ học tập. Em cần điều chỉnh thái độ, nề nếp và tăng cường tinh thần trách nhiệm với bản thân và tập thể.`,
      `Em {name} có nhiều ưu điểm trong học tập, đặc biệt là khả năng tiếp thu và vận dụng kiến thức. Em cần tích cực rèn luyện kỷ luật, giao tiếp đúng mực và tham gia đầy đủ các hoạt động chung.`
    ].map(repl);
  }

  // 4. Khá - Tốt
  if (academic === 'Khá' && conduct === 'Tốt') {
    return [
      `Em {name} có ý thức rèn luyện tốt, chăm chỉ, lễ phép và tích cực tham gia các hoạt động của lớp. Kết quả học tập đạt mức khá; em cần tiếp tục rèn luyện phương pháp tự học để nâng cao chất lượng các môn học.`,
      `Em {name} có tinh thần trách nhiệm, biết đoàn kết và hỗ trợ bạn bè. Trong học tập, em hoàn thành khá tốt nhiệm vụ được giao, cần chủ động phát biểu và mạnh dạn trình bày ý kiến hơn.`,
      `Em {name} ngoan, có nề nếp tốt, biết chấp hành nội quy và tích cực trong sinh hoạt tập thể. Em cần duy trì sự chăm chỉ, tăng cường luyện tập ở các nội dung còn hạn chế để đạt kết quả học tập tốt hơn.`
    ].map(repl);
  }

  // 5. Khá - Khá
  if (academic === 'Khá' && conduct === 'Khá') {
    return [
      `Em {name} có kết quả học tập và rèn luyện ở mức khá. Em có ý thức học tập, biết hoàn thành nhiệm vụ được giao; cần chủ động hơn trong tự học và tích cực tham gia hoạt động tập thể.`,
      `Em {name} tiếp thu kiến thức khá tốt, có cố gắng trong học tập. Em cần rèn luyện thêm tính tự giác, tác phong học tập nghiêm túc và tinh thần hợp tác với bạn bè.`,
      `Em {name} có nhiều tiến bộ trong học tập và rèn luyện. Em nên duy trì thói quen chuẩn bị bài, tích cực phát biểu xây dựng bài và thực hiện tốt hơn các quy định của lớp.`
    ].map(repl);
  }

  // 6. Khá - Đạt
  if (academic === 'Khá' && conduct === 'Đạt') {
    return [
      `Em {name} có khả năng học tập khá, hoàn thành được các yêu cầu cơ bản và có tiến bộ ở một số môn. Em cần chú ý hơn đến nề nếp, kỷ luật và tinh thần trách nhiệm trong sinh hoạt tập thể.`,
      `Em {name} có năng lực tiếp thu bài khá tốt, nhưng đôi lúc chưa thật sự ổn định trong việc thực hiện nội quy. Em cần rèn luyện tính tự giác, nghiêm túc và chủ động hơn trong các hoạt động chung.`,
      `Em {name} có kết quả học tập khá, biết hoàn thành nhiệm vụ học tập. Em cần điều chỉnh tác phong, tăng cường ý thức kỷ luật và phối hợp tốt hơn với thầy cô, bạn bè.`
    ].map(repl);
  }

  // 7. Đạt - Tốt
  if (academic === 'Đạt' && conduct === 'Tốt') {
    return [
      `Em {name} có ý thức rèn luyện tốt, lễ phép, chăm chỉ và biết chấp hành nội quy. Kết quả học tập đạt yêu cầu; em cần tăng cường tự học, ôn tập kiến thức trọng tâm để tiến bộ hơn.`,
      `Em {name} ngoan, có tinh thần trách nhiệm và tích cực trong sinh hoạt tập thể. Trong học tập, em cần chủ động hỏi bài, luyện tập thường xuyên và mạnh dạn trao đổi với thầy cô, bạn bè.`,
      `Em {name} có thái độ học tập nghiêm túc, biết cố gắng hoàn thành nhiệm vụ. Em cần củng cố kiến thức nền, rèn luyện kỹ năng trình bày và duy trì thói quen học tập hằng ngày.`
    ].map(repl);
  }

  // 8. Đạt - Khá
  if (academic === 'Đạt' && conduct === 'Khá') {
    return [
      `Em {name} đã hoàn thành các yêu cầu học tập cơ bản và có ý thức rèn luyện khá. Em cần chăm chỉ hơn trong tự học, chuẩn bị bài và tích cực tham gia xây dựng bài trên lớp.`,
      `Em {name} có cố gắng trong học tập và sinh hoạt tập thể. Em cần rèn luyện thêm tính chủ động, tập trung trong giờ học và thực hiện đều đặn nhiệm vụ học tập ở nhà.`,
      `Em {name} có kết quả học tập đạt yêu cầu, biết chấp hành nội quy ở mức khá. Em nên tăng cường luyện tập, mạnh dạn trao đổi khi chưa hiểu bài và tích cực hơn trong các hoạt động chung.`
    ].map(repl);
  }

  // 9. Đạt - Đạt
  if (academic === 'Đạt' && conduct === 'Đạt') {
    return [
      `Em {name} đã đạt yêu cầu cơ bản trong học tập và rèn luyện. Em cần tiếp tục cố gắng, tăng cường tự học, hoàn thành đầy đủ nhiệm vụ và thực hiện nghiêm túc hơn nội quy của lớp.`,
      `Em {name} có cố gắng nhưng kết quả học tập và rèn luyện chưa thật sự ổn định. Em cần tập trung hơn trong giờ học, chủ động ôn tập kiến thức và rèn luyện tác phong nghiêm túc.`,
      `Em {name} cần phát huy sự cố gắng, duy trì chuyên cần và hoàn thành tốt hơn các nhiệm vụ học tập. Gia đình và nhà trường cần phối hợp để hỗ trợ em hình thành thói quen tự học.`
    ].map(repl);
  }

  // 10. Chưa đạt - Tốt
  if (academic === 'Chưa đạt' && conduct === 'Tốt') {
    return [
      `Em {name} có ý thức rèn luyện tốt, lễ phép và chấp hành nội quy. Tuy nhiên, kết quả học tập chưa đạt yêu cầu; em cần được hỗ trợ củng cố kiến thức nền và rèn luyện phương pháp học tập phù hợp.`,
      `Em {name} có thái độ rèn luyện tích cực, biết tôn trọng thầy cô và bạn bè. Em cần cố gắng nhiều hơn trong học tập, tăng thời gian ôn bài và thường xuyên trao đổi với giáo viên khi gặp khó khăn.`,
      `Em {name} có phẩm chất tốt, chăm chỉ trong sinh hoạt tập thể nhưng kết quả học tập còn hạn chế. Em cần xây dựng kế hoạch học tập cụ thể, tập trung vào các môn còn yếu để từng bước tiến bộ.`
    ].map(repl);
  }

  // 11. Chưa đạt - Khá
  if (academic === 'Chưa đạt' && conduct === 'Khá') {
    return [
      `Em {name} có ý thức rèn luyện khá, biết chấp hành nội quy nhưng kết quả học tập chưa đạt yêu cầu. Em cần tăng cường tự học, hoàn thành đầy đủ bài tập và củng cố kiến thức còn thiếu.`,
      `Em {name} có cố gắng trong rèn luyện, song việc học tập còn gặp khó khăn ở một số môn. Em cần tập trung hơn trong giờ học, chủ động hỏi bài và duy trì lịch ôn tập thường xuyên.`,
      `Em {name} cần tiếp tục phát huy ý thức rèn luyện, đồng thời cải thiện kết quả học tập bằng việc học bài đều đặn, luyện tập các kiến thức trọng tâm và phối hợp với giáo viên để khắc phục hạn chế.`
    ].map(repl);
  }

  // 12. Chưa đạt - Đạt
  if (academic === 'Chưa đạt' && conduct === 'Đạt') {
    return [
      `Em {name} cần cố gắng nhiều hơn trong học tập và rèn luyện. Em nên tập trung nghe giảng, hoàn thành nhiệm vụ học tập, thực hiện nghiêm túc nội quy và chủ động nhờ thầy cô hỗ trợ khi gặp khó khăn.`,
      `Em {name} còn hạn chế trong việc tiếp thu và vận dụng kiến thức, kết quả học tập chưa đạt yêu cầu. Em cần tăng cường chuyên cần, rèn luyện tính tự giác và củng cố kiến thức cơ bản.`,
      `Em {name} cần được gia đình và nhà trường phối hợp hỗ trợ thường xuyên. Em nên xây dựng thói quen học tập hằng ngày, thực hiện tốt nội quy và từng bước cải thiện kết quả học tập, rèn luyện.`
    ].map(repl);
  }

  // 13. Đạt - Chưa đạt
  if (academic === 'Đạt' && conduct === 'Chưa đạt') {
    return [
      `Em {name} đã đạt yêu cầu cơ bản trong học tập nhưng kết quả rèn luyện chưa đạt. Em cần nghiêm túc điều chỉnh hành vi, thực hiện đúng nội quy và nâng cao tinh thần trách nhiệm với bản thân, tập thể.`,
      `Em {name} có khả năng hoàn thành nhiệm vụ học tập cơ bản, tuy nhiên cần cố gắng nhiều hơn trong rèn luyện nề nếp. Em cần biết lắng nghe góp ý, ứng xử đúng mực và chấp hành tốt quy định của trường lớp.`,
      `Em {name} cần tập trung rèn luyện ý thức kỷ luật, tinh thần hợp tác và trách nhiệm trong sinh hoạt tập thể. Việc thực hiện tốt nội quy sẽ giúp em tiến bộ ổn định hơn trong thời gian tới.`
    ].map(repl);
  }

  // 14. Khá/Tốt - Chưa đạt
  if ((academic === 'Khá' || academic === 'Tốt') && conduct === 'Chưa đạt') {
    return [
      `Em {name} có năng lực học tập khá tốt, tiếp thu bài nhanh và hoàn thành được nhiệm vụ học tập. Tuy nhiên, kết quả rèn luyện chưa đạt; em cần nghiêm túc điều chỉnh nề nếp, thái độ và hành vi trong sinh hoạt tập thể.`,
      `Em {name} có ưu điểm về học tập nhưng cần quan tâm nhiều hơn đến việc rèn luyện phẩm chất, ý thức kỷ luật và trách nhiệm. Em cần chấp hành tốt nội quy, biết tôn trọng thầy cô, bạn bè và tích cực sửa đổi hạn chế.`,
      `Em {name} có khả năng học tập tốt, song cần cải thiện rõ rệt về ý thức rèn luyện. Gia đình và nhà trường cần phối hợp để giúp em thực hiện tốt nội quy, hình thành tác phong nghiêm túc và thái độ tích cực.`
    ].map(repl);
  }

  // 15. Chưa đạt - Chưa đạt
  if (academic === 'Chưa đạt' && conduct === 'Chưa đạt') {
    return [
      `Em {name} chưa đạt yêu cầu về học tập và rèn luyện. Em cần nghiêm túc xây dựng lại thói quen học tập, thực hiện đúng nội quy, tăng cường chuyên cần và chủ động tiếp nhận sự hỗ trợ từ thầy cô, gia đình.`,
      `Em {name} còn gặp nhiều khó khăn trong học tập và chưa thực hiện tốt nề nếp rèn luyện. Em cần tập trung củng cố kiến thức cơ bản, hoàn thành nhiệm vụ học tập và điều chỉnh hành vi theo quy định của nhà trường.`,
      `Em {name} cần có sự cố gắng rõ rệt trong thời gian tới. Gia đình và nhà trường cần phối hợp chặt chẽ để hỗ trợ em rèn luyện ý thức kỷ luật, thói quen tự học và tinh thần trách nhiệm.`
    ].map(repl);
  }

  // Fallback default
  return [
    `Em {name} có kết quả học tập và rèn luyện khá tốt. Em cố gắng nghe giảng, tích học bài và làm bài đầy đủ.`,
    `Em {name} chăm chỉ học tập, ngoan ngoãn vâng lời thầy cô.`,
    `Em {name} cần tiếp tục phấn đấu, rèn luyện nề nếp tinh thần tự học tự rèn.`
  ].map(repl);
};

export const getShortHocBaComment = (academic: string, name: string): string => {
  const repl = (txt: string) => txt.replace(/\{name\}/g, name);
  if (academic === 'Tốt') {
    return repl(`Em {name} có ý thức học tập và rèn luyện tốt, chăm chỉ, trách nhiệm, biết hợp tác với bạn bè và tích cực tham gia hoạt động tập thể. Em cần tiếp tục phát huy tinh thần tự học, sáng tạo để đạt kết quả cao hơn.`);
  } else if (academic === 'Khá') {
    return repl(`Em {name} có nhiều cố gắng trong học tập và rèn luyện, cơ bản hoàn thành tốt nhiệm vụ được giao. Em cần chủ động hơn trong tự học, tích cực phát biểu và tham gia đều hơn các hoạt động chung.`);
  } else if (academic === 'Đạt') {
    return repl(`Em {name} đã đạt yêu cầu cơ bản trong học tập và rèn luyện. Em cần tăng cường tự học, tập trung hơn trong giờ học, hoàn thành đầy đủ nhiệm vụ và thực hiện nghiêm túc nội quy.`);
  } else {
    return repl(`Em {name} chưa đạt yêu cầu ở một số nội dung học tập/rèn luyện. Em cần được hỗ trợ củng cố kiến thức nền, rèn luyện thói quen tự học, tăng cường chuyên cần và nghiêm túc thực hiện nội quy.`);
  }
};

export const PHAM_CHAT_LIST = [
  { key: 'Chăm chỉ', text: 'Em {name} chăm chỉ học tập, có ý thức hoàn thành nhiệm vụ được giao và biết cố gắng khắc phục khó khăn.' },
  { key: 'Trách nhiệm', text: 'Em {name} có tinh thần trách nhiệm với bản thân và tập thể, biết thực hiện nhiệm vụ học tập, sinh hoạt theo yêu cầu.' },
  { key: 'Nhân ái', text: 'Em {name} biết quan tâm, chia sẻ, hỗ trợ bạn bè và có thái độ hòa nhã trong giao tiếp.' },
  { key: 'Trung thực', text: 'Em {name} có ý thức trung thực trong học tập, kiểm tra và sinh hoạt tập thể.' },
  { key: 'Yêu nước', text: 'Em {name} có ý thức tham gia các hoạt động giáo dục truyền thống, biết giữ gìn nền nếp và hình ảnh của học sinh nhà trường.' }
];

export const NANG_LUC_LIST = [
  { key: 'Tự chủ và tự học', text: 'Em {name} biết tự học, chuẩn bị bài và chủ động hoàn thành nhiệm vụ học tập.' },
  { key: 'Giao tiếp và hợp tác', text: 'Em {name} biết trao đổi, hợp tác với bạn bè trong học tập và tham gia hoạt động nhóm.' },
  { key: 'Giải quyết vấn đề và sáng tạo', text: 'Em {name} biết vận dụng kiến thức để giải quyết nhiệm vụ học tập, bước đầu có ý tưởng sáng tạo trong thực hiện sản phẩm.' },
  { key: 'Năng lực ngôn ngữ', text: 'Em {name} diễn đạt tương đối rõ ràng, biết trình bày suy nghĩ bằng lời nói và bài viết.' },
  { key: 'Năng lực tính toán', text: 'Em {name} biết vận dụng kiến thức học tập để giải bài tập và một số tình huống học tập.' },
  { key: 'Năng lực khoa học', text: 'Em {name} có ý thức quan sát, tìm hiểu và vận dụng kiến thức vào thực tế.' },
  { key: 'Năng lực công nghệ, tin học', text: 'Em {name} biết sử dụng thiết bị và công cụ học tập số ở mức phù hợp, phục vụ nhiệm vụ học tập.' },
  { key: 'Năng lực thẩm mĩ', text: 'Em {name} có ý thức giữ gìn sản phẩm học tập sạch đẹp, trình bày bài cẩn thận.' },
  { key: 'Năng lực thể chất', text: 'Em {name} có ý thức rèn luyện sức khỏe, tham gia các hoạt động thể chất phù hợp.' }
];
