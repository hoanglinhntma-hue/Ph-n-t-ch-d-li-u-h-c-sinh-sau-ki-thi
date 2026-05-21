
import { GoogleGenAI } from "@google/genai";
import { ClassStats } from "./types";

/**
 * Phân tích nội bộ không cần mạng/API Key
 * Dựa trên dữ liệu thực tế của lớp và quy tắc Thông tư 22
 */
const getLocalPedagogicalAdvice = (stats: ClassStats): string => {
  const totPercent = ((stats.totCount / stats.total) * 100).toFixed(1);
  const tiems = stats.tiemCanTotCount + stats.tiemCanKhaCount + stats.tiemCanDatCount;
  
  let advice = `### 📊 Báo cáo Phân tích Nội bộ (Offline Mode)\n\n`;
  advice += `**1. Nhận xét cơ cấu:**\n`;
  advice += `- Đơn vị hiện có **${stats.totCount}** học sinh Tốt (${totPercent}%). `;
  
  if (stats.chuaDatCount > stats.total * 0.2) {
    advice += `Tỉ lệ học sinh Nguy hiểm khá cao (${((stats.chuaDatCount / stats.total) * 100).toFixed(1)}%), cần chú trọng phụ đạo.\n`;
  } else {
    advice += `Cơ cấu học lực tương đối ổn định.\n`;
  }

  advice += `\n**2. Chiến lược bứt phá cho nhóm Tiệm cận & Nguy cơ (${tiems} học sinh):**\n`;
  
  if (stats.tiemCanTotCount > 0) {
    advice += `- **Nhóm Tiệm cận Tốt:** Tập trung bồi dưỡng 1-2 môn có điểm từ 7.5 - 7.9. Theo quy tắc +0.5, đây là nhóm dễ nâng hạng nhất.\n`;
  }
  if (stats.tiemCanKhaCount > 0) {
    advice += `- **Nhóm Tiệm cận Khá:** Kiểm tra các môn đang vướng điểm < 5.0. Chỉ cần 01 môn bứt phá lên 5.0, học sinh sẽ thoát khỏi diện Tiệm cận.\n`;
  }
  if (stats.tiemCanDatCount > 0) {
    advice += `- **Nhóm Nguy cơ:** Động viên học sinh ở các môn có điểm sát ngưỡng 3.5. Tránh để rơi xuống điểm liệt.\n`;
  }

  advice += `\n**3. Khuyến nghị thực chiến:**\n`;
  advice += `- **Cá nhân hóa mục tiêu:** Sử dụng bảng "Dự báo What-if" để chỉ rõ cho học sinh thấy các em chỉ thiếu một chút nỗ lực (+0.5 điểm) là thay đổi được thứ hạng.\n`;
  advice += `- **Phân nhóm học tập:** Ghép đôi học sinh "Tốt" kèm cặp nhóm "Tiệm cận" ở những môn mục tiêu.\n`;
  advice += `- **Lưu ý:** Sự tiến bộ khả quan nhất thường nằm ở mức tăng 0.5 điểm/kỳ. Đừng tạo áp lực quá lớn vượt ngưỡng này.`;

  return advice;
};

export const getPedagogicalAdvice = async (stats: ClassStats): Promise<{text: string, source: 'AI' | 'Local'}> => {
  const apiKey = process.env.API_KEY;

  // Nếu không có API Key, dùng ngay phân tích nội bộ
  if (!apiKey || apiKey === "undefined") {
    return { text: getLocalPedagogicalAdvice(stats), source: 'Local' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Dưới đây là thống kê kết quả học tập của một đơn vị giáo dục dựa trên Thông tư 22 (TT22):
      - Tổng số học sinh: ${stats.total}
      - Học sinh Tốt: ${stats.totCount}
      - Tiệm cận Tốt: ${stats.tiemCanTotCount}
      - Học sinh Khá: ${stats.khaCount}
      - Tiệm cận Khá: ${stats.tiemCanKhaCount}
      - Học sinh Đạt: ${stats.datCount}
      - Nguy cơ (Tiệm cận Đạt): ${stats.tiemCanDatCount}
      - Nguy hiểm (Chưa đạt): ${stats.chuaDatCount}

      Nhiệm vụ:
      1. Phân tích nhanh cơ cấu học lực này (gồm cả nhóm Nguy cơ và Nguy hiểm).
      2. Đưa ra 3 khuyến nghị "thực chiến" hỗ trợ nhóm "Tiệm cận" và "Nguy cơ" nâng hạng (chú ý ngưỡng bứt phá +0.5).
      3. Đề xuất cách tối ưu hóa mặt bằng chung.

      Yêu cầu: Ngắn gọn, chuyên nghiệp, ngôn ngữ sư phạm Tiếng Việt.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const text = response.text;
    if (!text) throw new Error("Empty AI response");
    
    return { text, source: 'AI' };
  } catch (error) {
    console.warn("Gemini API Error or Offline, falling back to local analysis:", error);
    // Khi có lỗi (hết mạng, lỗi key), tự động dùng phân tích nội bộ
    return { text: getLocalPedagogicalAdvice(stats), source: 'Local' };
  }
};
