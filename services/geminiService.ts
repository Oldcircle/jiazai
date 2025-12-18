
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
import { SpinnerData, ModelConfig } from "../types";

// --- PROMPTS & SCHEMAS ---

const SYSTEM_INSTRUCTION = `
You are a high-performance creative coding AI specialized in p5.js.
Your goal is to generate visually stunning, seamlessly looping loading spinners that work well as cursor icons.

CONSTRAINTS:
1. The code must be the *body* of a function that accepts a p5 instance named 'p'.
2. Example format:
   p.setup = () => { 
      p.createCanvas(400, 400); 
      p.colorMode(p.HSB, 360, 100, 100); 
   };
   p.draw = () => { 
      p.clear(); 
      // ... drawing logic
   };
3. CANVAS & LAYOUT: 
   - The canvas size is 400x400.
   - IMPORTANT: Maximize the use of space. Fill the canvas.
   - Keep drawing elements within a 380x380 pixel safe zone centered on the canvas (Radius 190px).
   - Do not leave excessive empty space around the edges.

4. CONTINUOUS ANIMATION:
   - The animation should be continuous, seamless, and hypnotic.
   - Do NOT force a loop reset using modulo (e.g., avoid t % 4000). 
   - Use 'p.millis()' or 'p.frameCount' directly to drive motion.
   - Use sine waves, rotation, and noise for natural, infinite flows.

5. CURSOR LEGIBILITY:
   - These designs will be downscaled to 32x32 pixels for use as mouse cursors.
   - Use THICK strokes (strokeWeight > 15 relative to 400px canvas).
   - Avoid tiny details. Focus on bold, clear shapes and high contrast.
   - AVOID standard colors (red, blue). Use HSB or specific Hex.
   
6. Evolution Logic:
   - If 'Previous Code' is provided: Analyze it. Keep 80% of the logic (lineage). Drastically mutate 20% (creativity).
   - If 'Previous Code' is null: Create a "Progenitor" seed spinner. Simple but elegant.

7. NO BACKGROUNDS: The spinner must be floating on a transparent canvas. 
   - Use 'p.clear()' at the start of 'p.draw()'. 
   - Do NOT use 'p.background()'.

8. SYNTAX: Do not wrap the code in markdown blocks (\`\`\`). Do not wrap the code in a closure. Just return the executable lines to go inside the wrapper function.
9. FORMATTING: Use 2-space indentation and newlines to make the code readable.
10. OUTPUT FORMAT: Return ONLY a JSON object with keys: "mutationName", "reasoning", "p5Code".
`;

// Google SDK Schema
const googleResponseSchema = {
  type: Type.OBJECT,
  properties: {
    mutationName: {
      type: Type.STRING,
      description: "A cool, sci-fi sounding name for this specific mutation.",
    },
    reasoning: {
      type: Type.STRING,
      description: "A single sentence explaining the evolutionary logic.",
    },
    p5Code: {
      type: Type.STRING,
      description: "The function body for a p5.js instance mode sketch.",
    },
  },
  required: ["mutationName", "reasoning", "p5Code"],
};

// --- API IMPLEMENTATIONS ---

async function generateWithGoogle(
  apiKey: string, 
  modelName: string, 
  prompt: string, 
  onStreamUpdate: (text: string) => void
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  
  // Clean model name if user entered shorthand or common aliases in config
  let cleanModel = modelName;
  if (!cleanModel) cleanModel = "gemini-3-flash-preview";

  const streamResult = await ai.models.generateContentStream({
    model: cleanModel,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: googleResponseSchema,
      thinkingConfig: { thinkingLevel: 'MINIMAL' }
    },
  });

  let fullText = "";
  for await (const chunk of streamResult) {
    const chunkText = chunk.text || "";
    fullText += chunkText;
    onStreamUpdate(fullText);
  }
  return fullText;
}

async function generateWithOpenAICompatible(
  apiKey: string,
  baseUrl: string,
  modelName: string,
  prompt: string,
  onStreamUpdate: (text: string) => void
): Promise<string> {
  
  // Force JSON mode for OpenAI/DeepSeek if possible, or append to prompt
  const finalSystemPrompt = SYSTEM_INSTRUCTION + "\n\nIMPORTANT: Return ONLY valid JSON.";
  
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: prompt }
      ],
      stream: true,
      response_format: { type: "json_object" } // Try to force JSON mode
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error ${response.status}: ${err}`);
  }

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices?.[0]?.delta?.content || "";
          if (content) {
            fullText += content;
            onStreamUpdate(fullText);
          }
        } catch (e) {
          // ignore parse errors for partial chunks
        }
      }
    }
  }
  return fullText;
}

// --- MAIN SERVICE EXPORT ---

export const generateNextSpinner = async (
  previousCode: string | null,
  previousId: number,
  config: ModelConfig,
  onStreamUpdate: (text: string) => void
): Promise<SpinnerData> => {
  const startTime = performance.now();
  
  const prompt = previousCode 
    ? `PREVIOUS SPINNER CODE:\n${previousCode}\n\nINSTRUCTION: take one component from the spinner that you like, to develop the next one. Keep the output valid JSON.`
    : `INSTRUCTION: Generate the Progenitor (Gen 1). A pure, minimal geometric loop. Return valid JSON.`;

  // Fallback to Env if Key is missing in Config (for default config)
  const effectiveKey = config.apiKey || process.env.API_KEY || "";
  
  if (!effectiveKey && !config.baseUrl.includes('localhost')) {
     throw new Error("Missing API Key");
  }

  let fullText = "";

  try {
    if (config.provider === 'google') {
       fullText = await generateWithGoogle(effectiveKey, config.modelName, prompt, onStreamUpdate);
    } else {
       // OpenAI, DeepSeek, Ollama, etc.
       fullText = await generateWithOpenAICompatible(effectiveKey, config.baseUrl, config.modelName, prompt, onStreamUpdate);
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;
    
    // Robust JSON Parsing
    // If the model returned markdown code blocks ```json ... ```, strip them
    let jsonStr = fullText.trim();
    if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '');
    } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '');
    }
    
    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    } catch (e) {
        // Fallback: Try to use the partial parser from logic if the end is malformed, 
        // or simplistic regex extraction if completely broken
        console.warn("JSON Parse failed, attempting regex extraction", e);
        // Simple regex fallback
        const nameMatch = jsonStr.match(/"mutationName":\s*"([^"]*)"/);
        const reasonMatch = jsonStr.match(/"reasoning":\s*"([^"]*)"/);
        // Code is harder to regex due to newlines, but let's try
        // This is a last resort fallback
        parsed = {
            mutationName: nameMatch ? nameMatch[1] : "Unknown Mutation",
            reasoning: reasonMatch ? reasonMatch[1] : "Parsing failed",
            p5Code: jsonStr.includes("p.setup") ? jsonStr : "" // If it's just code, use it
        };
        // If the response *was* the JSON object but dirty
        const codeMatch = jsonStr.match(/"p5Code":\s*"([\s\S]*?)"\s*}/);
        if (codeMatch) parsed.p5Code = codeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }

    const estimatedTokens = fullText.length / 4;
    const tps = (estimatedTokens / (durationMs / 1000));

    return {
      id: previousId + 1,
      mutationName: parsed.mutationName || "Evolution",
      reasoning: parsed.reasoning || "Evolved from previous state.",
      p5Code: parsed.p5Code || "",
      timestamp: Date.now(),
      generationTimeMs: durationMs,
      tokensPerSecond: parseFloat(tps.toFixed(1)),
      totalTokens: Math.round(estimatedTokens),
      tpsHistory: [],
    };

  } catch (error) {
    console.error("Generation failed:", error);
    throw error;
  }
};
