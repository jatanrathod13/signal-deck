/**
 * EvaluatorService - Output quality evaluation loop.
 * Implements WP-08: Evaluator loop + auto-revision/fail policy.
 */

import {
  EvaluationPolicy,
  EvaluatorResult
} from '../../types';
import { appendRunEvent } from './conversationService';

const DEFAULT_MIN_SCORE = 0.5;
const DEFAULT_MAX_REVISIONS = 2;
const DEFAULT_CRITERIA = ['completeness', 'accuracy', 'relevance', 'coherence'];

/**
 * Lightweight heuristic evaluator for agent outputs.
 * In production, this would call an LLM to grade the output.
 */
function heuristicEvaluate(
  output: string,
  criteria: string[],
  prompt: string
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const criterion of criteria) {
    switch (criterion) {
      case 'completeness': {
        // Does the output address the prompt?
        const promptWords = new Set(prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
        const outputLower = output.toLowerCase();
        const covered = Array.from(promptWords).filter((w) => outputLower.includes(w)).length;
        scores[criterion] = promptWords.size > 0 ? Math.min(1, covered / promptWords.size) : 0.5;
        break;
      }
      case 'accuracy': {
        // Heuristic: penalize very short or very long responses
        const wordCount = output.split(/\s+/).length;
        if (wordCount < 5) {
          scores[criterion] = 0.2;
        } else if (wordCount > 5000) {
          scores[criterion] = 0.6;
        } else {
          scores[criterion] = 0.8;
        }
        break;
      }
      case 'relevance': {
        // Check if output mentions key terms from the prompt
        const keyTerms = prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 4).slice(0, 10);
        const outputLower = output.toLowerCase();
        const matches = keyTerms.filter((t) => outputLower.includes(t)).length;
        scores[criterion] = keyTerms.length > 0 ? Math.min(1, matches / keyTerms.length) : 0.5;
        break;
      }
      case 'coherence': {
        // Heuristic: check sentence structure
        const sentences = output.split(/[.!?]+/).filter((s) => s.trim().length > 0);
        scores[criterion] = sentences.length > 0 ? Math.min(1, 0.5 + (sentences.length / 20)) : 0.3;
        break;
      }
      default:
        scores[criterion] = 0.5;
    }
  }

  return scores;
}

/**
 * Run the evaluator loop against an agent output.
 */
export async function evaluateOutput(
  output: string,
  prompt: string,
  policy: EvaluationPolicy,
  context: {
    runId?: string;
    conversationId?: string;
  }
): Promise<EvaluatorResult> {
  if (!policy.enabled) {
    const result: EvaluatorResult = {
      score: 1.0,
      criteria: {},
      feedback: 'Evaluation disabled by policy',
      passed: true,
      evaluatedAt: new Date()
    };
    return result;
  }

  const criteria = policy.criteria ?? DEFAULT_CRITERIA;
  const minScore = policy.minScoreThreshold ?? DEFAULT_MIN_SCORE;
  const criteriaScores = heuristicEvaluate(output, criteria, prompt);

  // Calculate overall score as average of criteria scores
  const scoreValues = Object.values(criteriaScores);
  const overallScore = scoreValues.length > 0
    ? scoreValues.reduce((sum, s) => sum + s, 0) / scoreValues.length
    : 0;

  const passed = overallScore >= minScore;

  const feedback = passed
    ? `Output passed evaluation with score ${overallScore.toFixed(2)} (threshold: ${minScore})`
    : `Output failed evaluation with score ${overallScore.toFixed(2)} (threshold: ${minScore}). ` +
      `Low-scoring criteria: ${Object.entries(criteriaScores)
        .filter(([, s]) => s < minScore)
        .map(([c, s]) => `${c}: ${s.toFixed(2)}`)
        .join(', ')}`;

  const result: EvaluatorResult = {
    score: overallScore,
    criteria: criteriaScores,
    feedback,
    passed,
    evaluatedAt: new Date()
  };

  // Emit evaluation event
  if (context.runId && context.conversationId) {
    appendRunEvent({
      runId: context.runId,
      conversationId: context.conversationId,
      type: 'evaluation.completed',
      payload: {
        score: result.score,
        passed: result.passed,
        criteria: result.criteria,
        feedback: result.feedback
      }
    });
  }

  return result;
}

/**
 * Run evaluator with optional auto-revision attempts.
 * Returns the final evaluator result after all revision attempts.
 */
export async function evaluateWithRevision(
  output: string,
  prompt: string,
  policy: EvaluationPolicy,
  context: {
    runId?: string;
    conversationId?: string;
  },
  revisionFn?: (feedback: string, previousOutput: string) => Promise<string>
): Promise<{ finalOutput: string; evaluatorResult: EvaluatorResult; revisionCount: number }> {
  const maxRevisions = policy.maxRevisionAttempts ?? DEFAULT_MAX_REVISIONS;
  let currentOutput = output;
  let revisionCount = 0;

  for (let attempt = 0; attempt <= maxRevisions; attempt++) {
    const result = await evaluateOutput(currentOutput, prompt, policy, context);

    if (result.passed || attempt === maxRevisions || !revisionFn) {
      return {
        finalOutput: currentOutput,
        evaluatorResult: result,
        revisionCount
      };
    }

    // Attempt revision
    revisionCount++;
    try {
      currentOutput = await revisionFn(result.feedback, currentOutput);
    } catch (error) {
      // If revision fails, return the last evaluation result
      result.feedback += ` | Revision attempt ${revisionCount} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return {
        finalOutput: currentOutput,
        evaluatorResult: result,
        revisionCount
      };
    }
  }

  // Should not reach here, but safety fallback
  return {
    finalOutput: currentOutput,
    evaluatorResult: await evaluateOutput(currentOutput, prompt, policy, context),
    revisionCount
  };
}
