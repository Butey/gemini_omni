import { GoogleGenAI } from "@google/genai";
async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  try {
    const res = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: "hi" });
    console.log("3.5 SUCCESS");
  } catch(e:any) { console.log("3.5:", e.message); }
}
test();
