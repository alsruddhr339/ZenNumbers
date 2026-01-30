
import { GoogleGenAI } from "@google/genai";

export const getMotivationalMessage = async (time: number, difficulty: string, lang: 'KO' | 'EN'): Promise<string> => {
  try {
    // Create instance right before call as per best practices
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = lang === 'KO' 
      ? `사용자가 숫자 순서 맞추기 게임(${difficulty} 난이도)을 ${time.toFixed(6)}초 만에 끝냈습니다. 아주 짧고, 엘리트적이며, 재치 있는 격언 스타일의 문장을 한국어로 15자 이내로 써주세요. 마스터 톤을 유지하세요.`
      : `User finished number sequence game (${difficulty}) in ${time.toFixed(6)}s. Give a short, elite, witty Zen Master style sentence in English (max 10 words) praising their focus.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.8,
        topP: 0.9,
      }
    });

    return response.text?.trim() || (lang === 'KO' ? "완벽한 집중력이었습니다." : "Absolute focus.");
  } catch (error) {
    console.warn("Gemini Service Error (Likely API/Project config):", error);
    return lang === 'KO' ? "집중의 끝에서 승리를 거머쥐셨군요." : "Victory at the end of focus.";
  }
};
