
import { GoogleGenAI } from "@google/genai";
import { StudentData, ClassStats } from "./types";

export const getPedagogicalAdvice = async (stats: ClassStats, students: StudentData[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      Dưới đây là thống kê kết quả học tập của một đơn vị giáo dục (7 mức phân loại):
      - Tổng số học sinh: ${stats.total}
      - Học sinh Tốt: ${stats.totCount}
      - Tiệm cận Tốt: ${stats.tiemCanTotCount}
      - Học sinh Khá: ${stats.khaCount}
      - Tiệm cận Khá: ${stats.tiemCanKhaCount}
      - Học sinh Đạt: ${stats.datCount}
      - Tiệm cận Đạt: ${stats.tiemCanDatCount}
      - Chưa đạt: ${stats.chuaDatCount}

      Hãy đóng vai một chuyên gia tư vấn giáo dục chiến lược. Phân tích cơ cấu này và đưa ra 3 khuyến nghị cụ thể để nhà trường/giáo viên tập trung vào các nhóm "Tiệm cận" (Tốt, Khá, Đạt) giúp họ bứt phá lên mức cao hơn trong giai đoạn tiếp theo. Viết ngắn gọn, chuyên nghiệp bằng tiếng Việt.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Không thể tải lời khuyên từ AI.";
  } catch (error) {
    console.error("Error fetching AI advice:", error);
    return "Hãy tập trung hỗ trợ các nhóm tiệm cận để tối ưu hóa tỷ lệ khá giỏi của lớp.";
  }
};
