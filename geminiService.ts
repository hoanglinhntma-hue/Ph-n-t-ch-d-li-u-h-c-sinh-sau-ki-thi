
import { GoogleGenAI } from "@google/genai";
import { StudentData, ClassStats } from "./types";

export const getPedagogicalAdvice = async (stats: ClassStats, students: StudentData[]): Promise<string> => {
  try {
    // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Fixed: stats.chuaDatCount does not exist on ClassStats. Included stats.khaCount for better context.
    const prompt = `
      Dưới đây là thống kê kết quả học tập của một lớp:
      - Tổng số học sinh: ${stats.total}
      - Tốt: ${stats.totCount}
      - Tiệm cận Tốt: ${stats.tiemCanTotCount}
      - Khá: ${stats.khaCount}
      - Đạt (Cần đầu tư): ${stats.datCount}
      - Nguy cơ: ${stats.nguyCoCount}

      Hãy đóng vai một chuyên gia tư vấn giáo dục, phân tích tình hình và đưa ra 3 lời khuyên chiến lược cho giáo viên chủ nhiệm để cải thiện chất lượng học tập trong học kỳ tới. Viết ngắn gọn, súc tích bằng tiếng Việt.
    `;

    // Using gemini-3-flash-preview for summarization and analysis tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Directly access the .text property of GenerateContentResponse.
    return response.text || "Không thể tải lời khuyên từ AI.";
  } catch (error) {
    console.error("Error fetching AI advice:", error);
    return "Hãy tập trung hỗ trợ nhóm học sinh nguy cơ và bồi dưỡng nhóm tiệm cận tốt.";
  }
};
