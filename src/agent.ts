import dotenv from 'dotenv';
dotenv.config();

import { init, span, flush, shutdown } from 'neatlogs';
import { wrapGoogleGenAI } from 'neatlogs/google-genai';
import { GoogleGenAI } from '@google/genai';

let isInitialized = false;

/**
 * Initialize Neatlogs tracing once.
 * Configured with the regional endpoint https://ingest.neatlogs.com
 * and workflow name describing the agent task.
 */
export async function initAgentTracing(): Promise<void> {
  if (isInitialized) {
    return;
  }

  await init({
    apiKey: process.env.NEATLOGS_API_KEY,
    endpoint: 'https://ingest.neatlogs.com',
    workflowName: 'support-agent',
  });

  isInitialized = true;
}

/**
 * Obtain an instrumented Google GenAI client instance.
 * wrapGoogleGenAI patches the instance without global monkey-patching.
 */
export function getInstrumentedClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const rawClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return wrapGoogleGenAI(rawClient);
}

export interface AgentExecutionResult {
  prompt: string;
  response: string;
  model: string;
  timestamp: string;
}

const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

/**
 * Main AI Agent entry point wrapped with a WORKFLOW span.
 * Traces the complete lifecycle of an agent execution with retry and graceful fallback.
 */
export const executeAgentTask = span(
  { kind: 'WORKFLOW', name: 'support_agent_workflow' },
  async (prompt: string, modelName: string = 'gemini-3.8-flash'): Promise<AgentExecutionResult> => {
    await initAgentTracing();

    const client = getInstrumentedClient();
    const modelsToTry = [
      modelName,
      ...FALLBACK_MODELS.filter((m) => m !== modelName),
    ];

    let lastError: any = null;

    for (const currentModel of modelsToTry) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await client.models.generateContent({
            model: currentModel,
            contents: prompt,
          });

          return {
            prompt,
            response: result.text || '',
            model: currentModel,
            timestamp: new Date().toISOString(),
          };
        } catch (err: any) {
          lastError = err;
          const errMsg = String(err?.message || JSON.stringify(err));
          const isTransient =
            errMsg.includes('503') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('high demand') ||
            errMsg.includes('429') ||
            errMsg.includes('RESOURCE_EXHAUSTED');

          if (isTransient && attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          break;
        }
      }
    }

    throw lastError;
  }
);

export { flush, shutdown };
