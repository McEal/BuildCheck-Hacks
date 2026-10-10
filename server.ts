import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { init, span, flush, shutdown } from 'neatlogs';
import { wrapGoogleGenAI } from 'neatlogs/google-genai';
import { GoogleGenAI } from '@google/genai';

// Initialize the Neatlogs SDK once at process startup
await init({
  apiKey: process.env.NEATLOGS_API_KEY,
  endpoint: 'https://ingest.neatlogs.com',
  workflowName: 'support-agent',
});

// Create and wrap Google GenAI client instance
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const rawClient = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});
const genAIClient = wrapGoogleGenAI(rawClient);

const app = express();
app.use(express.json());

// Status endpoint
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'online',
    projectId: '04e5735b-e4d8-45c4-8dc1-2493c29637e8',
    tracing: 'neatlogs',
    endpoint: 'https://ingest.neatlogs.com',
    workflow: 'support-agent',
    defaultModel: 'gemini-3.8-flash',
  });
});

const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

async function generateWithRetryAndFallback(userPrompt: string, preferredModel: string) {
  const modelsToTry = [
    preferredModel,
    ...FALLBACK_MODELS.filter((m) => m !== preferredModel),
  ];

  let lastError: any = null;

  for (const modelToAttempt of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await genAIClient.models.generateContent({
          model: modelToAttempt,
          contents: userPrompt,
        });
        return {
          text: response.text || '',
          usedModel: modelToAttempt,
          fellBack: modelToAttempt !== preferredModel,
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

// Agent execution endpoint — roots each request under its own WORKFLOW span
app.post('/api/agent', async (req, res) => {
  const { prompt, model = 'gemini-3.8-flash', sessionId, userId } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const handleAgentTurn = span(
      {
        kind: 'WORKFLOW',
        name: 'support_agent_chat',
        sessionId: sessionId || `session_${Date.now()}`,
        endUserId: userId || undefined,
      },
      async (userPrompt: string) => {
        return await generateWithRetryAndFallback(userPrompt, model);
      }
    );

    const result = await handleAgentTurn(prompt);
    res.json({
      answer: result.text,
      model: result.usedModel,
      fellBack: result.fellBack,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Agent execution error:', error);
    const rawMsg = error?.message || 'An error occurred while generating response';
    res.status(500).json({
      error: rawMsg,
    });
  }
});

// Graceful process shutdown handlers to flush spans before exit
const handleShutdown = async (signal: string) => {
  console.log(`Received ${signal}, flushing Neatlogs traces and shutting down...`);
  try {
    await flush();
    await shutdown();
  } catch (err) {
    console.error('Error during telemetry shutdown:', err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Application server running on port ${PORT}`);
  });
}

bootstrap();
