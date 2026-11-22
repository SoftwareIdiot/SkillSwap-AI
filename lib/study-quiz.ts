import { z } from "zod";

export const studyQuizSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(5).max(300),
        choices: z.array(z.string().trim().min(1).max(160)).length(4),
        correct: z.number().int().min(0).max(3),
        explanation: z.string().trim().min(5).max(500),
      }),
    )
    .length(3),
});

export type StudyQuiz = z.infer<typeof studyQuizSchema>;
