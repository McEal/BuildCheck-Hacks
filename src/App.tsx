import React, { useState } from 'react';
import { Bot, Send, Sparkles, Terminal, Activity, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  model?: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Hello! I am your AI Support Agent instrumented with Neatlogs distributed tracing. Send me any task or query to see live execution and span tracking.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'gemini-3.8-flash',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');

  const samplePrompts = [
    'Analyze an architecture design for distributed microservices',
    'Write a concise summary of OpenTelemetry span propagation',
    'Draft a helpful customer support response for a billing inquiry',
  ];

  const handleSend = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          model: selectedModel,
          sessionId: 'session_demo_app',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server error while processing agent turn');
      }

      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: data.answer || 'No response text returned.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: data.fellBack ? `${data.model} (fallback)` : data.model || selectedModel,
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (err: any) {
      let friendlyError = err.message || 'An error occurred';
      try {
        if (friendlyError.includes('{')) {
          const jsonStart = friendlyError.indexOf('{');
          const parsed = JSON.parse(friendlyError.slice(jsonStart));
          if (parsed?.error?.message) {
            friendlyError = parsed.error.message;
          }
        }
      } catch {
        // use raw message
      }

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        sender: 'agent',
        text: `Temporary capacity notice: ${friendlyError}\n\nOur system has auto-retry and failover enabled. You can retry now or switch to Gemini Flash Lite below.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* Sidebar with Neatlogs Observability details */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hidden md:flex">
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-400">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-100 text-lg leading-tight">Neatlogs Tracing</h1>
              <p className="text-xs text-slate-400">AI Observability & Spans</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>TRACING STATUS</span>
              <span className="flex items-center text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Active
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <p className="text-slate-500">Project ID</p>
                <p className="font-mono text-slate-300 break-all bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                  04e5735b-e4d8-45c4-8dc1-2493c29637e8
                </p>
              </div>
              <div>
                <p className="text-slate-500">Ingest Endpoint</p>
                <p className="font-mono text-slate-300 break-all bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                  https://ingest.neatlogs.com
                </p>
              </div>
              <div>
                <p className="text-slate-500">Workflow Scope</p>
                <p className="font-mono text-violet-400 bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                  support-agent
                </p>
              </div>
              <div>
                <p className="text-slate-500">Provider Wrapper</p>
                <p className="font-mono text-indigo-300 bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                  wrapGoogleGenAI
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Model Selection
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
            >
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Latest)</option>
              <option value="gemini-flash-latest">Gemini Flash Latest</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
            </select>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 text-xs text-slate-500 space-y-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Trace Context W3C Ready</span>
          </div>
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-violet-400" />
            <span>Server-side private provider</span>
          </div>
        </div>
      </aside>

      {/* Main Chat View */}
      <main className="flex-1 flex flex-col h-full bg-slate-950">
        {/* Header */}
        <header className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between bg-slate-900/30 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-medium text-slate-200">AI Support Agent</h2>
              <p className="text-xs text-slate-400">Traced with Neatlogs SDK</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Workflow: support-agent</span>
          </div>
        </header>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'agent' && (
                <div className="p-2 bg-violet-600/20 text-violet-400 rounded-xl border border-violet-500/30 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl px-5 py-4 ${
                  msg.sender === 'user'
                    ? 'bg-violet-600 text-white rounded-br-none shadow-lg shadow-violet-600/10'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed text-sm">{msg.text}</div>
                <div
                  className={`mt-2 flex items-center justify-between text-[11px] ${
                    msg.sender === 'user' ? 'text-violet-200' : 'text-slate-500'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {msg.model && (
                    <span className="font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-violet-300 ml-2">
                      {msg.model}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-violet-600/20 text-violet-400 rounded-xl border border-violet-500/30">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none px-5 py-4 flex items-center space-x-3">
                <RefreshCw className="w-4 h-4 text-violet-400 animate-spin" />
                <span className="text-sm text-slate-400">Agent executing turn & logging Neatlogs span...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar & Suggestion Prompts */}
        <div className="border-t border-slate-800/80 p-4 bg-slate-900/40">
          <div className="max-w-4xl mx-auto space-y-3">
            {messages.length <= 2 && (
              <div className="flex flex-wrap gap-2">
                {samplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="flex items-center space-x-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end space-x-3 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 focus-within:border-violet-500 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the AI agent anything (or press Enter to send)..."
                rows={2}
                className="flex-1 bg-transparent border-0 resize-none text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-2 py-1"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
