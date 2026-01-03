import { GoogleGenAI, Type } from "@google/genai";
import { ConceptExplanation, ApplicationData, QuizQuestion, LessonContent, CurriculumTopic, ProjectDetail } from "../types";

// Upgraded to Pro for complex technical reasoning and 10-question consistency
const modelName = 'gemini-3-pro-preview';

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getConceptExplanation = async (theory: string): Promise<ConceptExplanation> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Explain the following theory briefly and provide daily life examples for living and non-living things: ${theory}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          brief: { type: Type.STRING },
          dailyLife: {
            type: Type.OBJECT,
            properties: {
              living: { type: Type.ARRAY, items: { type: Type.STRING } },
              nonLiving: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["living", "nonLiving"]
          }
        },
        required: ["brief", "dailyLife"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const getCurriculum = async (theory: string, parts: number): Promise<CurriculumTopic[]> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Break down the theory "${theory}" into exactly ${parts} logical learning modules. Provide a title and a very short description for each. Ensure a logical progression from beginner to expert.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.NUMBER },
            title: { type: Type.STRING },
            shortDescription: { type: Type.STRING }
          },
          required: ["id", "title", "shortDescription"]
        }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};

export const getTopicDetail = async (theory: string, topicTitle: string): Promise<LessonContent> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Act as a master teacher. Provide a high-infrastructure lesson for the topic "${topicTitle}" of the theory "${theory}". 
    The lesson MUST have 3 sections: 
    1. "Theoretical Foundations" (The deep logic)
    2. "The Mechanism of Action" (How it works step-by-step)
    3. "System Integration" (How it plugs into the real world).
    Also include exactly 10 challenging multiple-choice questions for this specific module to ensure deep mastery.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          concept: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          },
          quizQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["id", "question", "options", "correctAnswer", "explanation"]
            }
          }
        },
        required: ["topic", "concept", "sections", "quizQuestions"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const generateDiagram = async (theory: string, topic: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ 
        text: `Create a professional, highly detailed technical diagram or scientific graph illustrating the concept: "${topic}" as part of "${theory}". 
        The image should look like a clean page from a modern university textbook. 
        Use clear labels, precise lines, and a minimal aesthetic.` 
      }]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate scientific visualization.");
};

export const getProjectDetail = async (theory: string, projectTitle: string): Promise<ProjectDetail> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Provide a comprehensive technical reference blueprint for the project "${projectTitle}" based on the theory "${theory}". 
    Include prerequisites, a 5-step roadmap, the logical architecture, and success metrics.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          theory: { type: Type.STRING },
          prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          architecture: { type: Type.STRING },
          successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "theory", "prerequisites", "steps", "architecture", "successMetrics"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const getMoreQuizzes = async (theory: string, topicTitle: string): Promise<QuizQuestion[]> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Generate exactly 10 fresh, challenging practical multiple-choice questions for the module "${topicTitle}" within the theory "${theory}". Avoid repeating common concepts.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.NUMBER },
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["id", "question", "options", "correctAnswer", "explanation"]
        }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};

export const getApplicationData = async (theory: string): Promise<ApplicationData> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Generate practical projects and industry-specific use cases for the theory: ${theory}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                difficulty: { type: Type.STRING }
              },
              required: ["title", "description", "difficulty"]
            }
          },
          industryUse: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sector: { type: Type.STRING },
                purpose: { type: Type.STRING }
              },
              required: ["sector", "purpose"]
            }
          }
        },
        required: ["projects", "industryUse"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const getQuizQuestions = async (theory: string): Promise<QuizQuestion[]> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Generate exactly 10 practical, multiple-choice questions for the theory: ${theory}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.NUMBER },
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["id", "question", "options", "correctAnswer", "explanation"]
        }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};