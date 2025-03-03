import OpenAI from "openai";
import { EvaluationResult } from "../types/practice";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// async function normalizeVoiceInput(
//   question: string,
//   rawAnswer: string
// ): Promise<string> {
//   try {
//     const prompt = `As an AI assistant, help me understand and normalize this voice recognition output. The speaker was answering a technical question about software development.

// Question asked: "${question}"
// Raw voice output: "${rawAnswer}"

// Please fix any obvious voice recognition errors and format the answer in clear, grammatically correct sentences
// Respond with ONLY the normalized text, no explanations or additional formatting.`;

//     const completion = await openai.chat.completions.create({
//       messages: [{ role: "user", content: prompt }],
//       model: "gpt-3.5-turbo",
//       temperature: 0.3,
//     });

//     return completion.choices[0].message.content?.trim() || rawAnswer;
//   } catch (error) {
//     console.error("Error normalizing voice input:", error);
//     return rawAnswer; // Return original input if normalization fails
//   }
// }

export async function evaluateAnswer(
  question: string,
  answer: string
  // followUpCount: number
): Promise<EvaluationResult> {
  try {
    // First, normalize the voice input
    // const normalizedAnswer = await normalizeVoiceInput(question, answer);
    // console.log("Normalized answer:", normalizedAnswer);

    const prompt = `As a senior software engineer, evaluate this answer to the question about software development. 
Question: "${question}"
Answer: "${answer}"


Try to understand what user means by the answer. He could use different words, but focus on the meaning first.
Don't be too strict. If user shows that he understand the topic, then give him good points.
Evaluate the answer. The total score should be max 10 points

If any of these are true, mark the question as done (isQuestionDone: true) and keep previous score:
- The answer shows the user doesn't know the topic and needs to study more
- The user explicitly wants to move to the next question
- The answer is completely off-topic

Respond in the following JSON format:
{
  "isGoodAnswer": boolean,
  "isQuestionDone": boolean,
  "score": number,
  "technicalAccuracy": number,
  "completeness": number,
  "clarity": number,
  "response": "your short response about the answer. Include points about the answer if it is not clear",

}

Make sure the total score (score) reflects the sum of technicalAccuracy, completeness, and clarity.`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 1,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    // Validate and ensure the score is calculated correctly
    const calculatedScore = Math.min(
      10,
      Math.max(
        0,
        (result.technicalAccuracy || 0) +
          (result.completeness || 0) +
          (result.clarity || 0)
      )
    );

    return {
      isGoodAnswer: result.isGoodAnswer || false,
      isQuestionDone: result.isQuestionDone || false,
      score: calculatedScore,
      response: result.response || "Unable to evaluate the answer properly.",
    };
  } catch (error) {
    console.error("Error evaluating answer:", error);

    // In case of error, provide a more informative default response
    const errorResponse = {
      isGoodAnswer: false,
      isQuestionDone: true,
      score: 0,
      response:
        "Sorry, I couldn't evaluate your answer properly. Let's move to the next question.",
    };

    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }

    return errorResponse;
  }
}
