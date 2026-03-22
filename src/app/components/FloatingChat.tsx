import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Send, X, Minimize2, Sparkles, Bot } from 'lucide-react';
import { useState } from 'react';
import type { AuditReport, AuditRequest } from '../../types';
import { chatWithLLM } from '../../lib/llmEngine';

interface ContextualPrompt {
  text: string;
}

interface FloatingChatProps {
  context: 'landing' | 'setup' | 'results';
  auditContext?: { request: AuditRequest; report: AuditReport };
}

const contextualPrompts: Record<string, ContextualPrompt[]> = {
  landing: [
    { text: 'What counts as feature leakage?' },
    { text: 'How does temporal leakage occur?' },
    { text: 'When should I run an audit?' },
  ],
  setup: [
    { text: 'What should I enter for prediction time point?' },
    { text: 'How do I define the observation window?' },
    { text: 'What split method is safest?' },
  ],
  results: [
    { text: 'Why is this finding marked as critical?' },
    { text: 'What should I fix first?' },
    { text: 'How was metric inflation calculated?' },
  ],
};

export function FloatingChat({ context, auditContext }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [showLabel, setShowLabel] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  const prompts = contextualPrompts[context] || contextualPrompts.landing;

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;

    setMessage('');
    setIsThinking(true);

    const historyForApi = conversation.map((m) => ({
      role: m.role,
      content: m.text,
    }));

    setConversation((prev) => [...prev, { role: 'user', text }]);

    if (context === 'results' && auditContext) {
      try {
        const answer = await chatWithLLM(
          text,
          auditContext.report,
          auditContext.request,
          historyForApi,
        );
        setConversation((prev) => [...prev, { role: 'assistant', text: answer || '(No response.)' }]);
      } catch {
        setConversation((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'Could not reach the chat API. Check that the server is running and try again.',
          },
        ]);
      }
      setIsThinking(false);
      return;
    }

    setTimeout(() => {
      const mockResponse = getMockResponse(text, context);
      setConversation((prev) => [...prev, { role: 'assistant', text: mockResponse }]);
      setIsThinking(false);
    }, 1200);
  };

  const handlePromptClick = (promptText: string) => {
    setMessage(promptText);
    setTimeout(() => {
      handleSend();
    }, 100);
  };

  return (
    <>
      {/* Floating Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="fixed bottom-8 right-8 z-50"
        onMouseEnter={() => setShowLabel(true)}
        onMouseLeave={() => !isOpen && setShowLabel(false)}
      >
        <AnimatePresence>
          {!isOpen && showLabel && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap"
            >
              <div className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-sm shadow-lg">
                Ask LeakGuard
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Breathing halo effect */}
        {!isOpen && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(93, 108, 128, 0.15) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.15, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={
            !isOpen
              ? {
                  y: [0, -4, 0],
                }
              : {}
          }
          transition={
            !isOpen
              ? {
                  y: {
                    duration: 2.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }
              : {}
          }
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-lg hover:bg-[var(--accent-primary)] transition-colors flex items-center justify-center"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <X className="w-5 h-5" />
              </motion.div>
            ) : (
              <motion.div
                key="robot"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Bot className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Chat Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-28 right-8 w-[400px] rounded-lg z-50 bg-white border border-[var(--border)] shadow-2xl overflow-hidden"
          >
            {!isMinimized && (
              <>
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--secondary)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-[var(--foreground)]">Ask LeakGuard</h3>
                        <p className="text-xs text-[var(--muted-foreground)]">Context-aware assistant</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsMinimized(true)}
                      className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1 hover:bg-white rounded"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Suggested Prompts - shown when no conversation */}
                {conversation.length === 0 && (
                  <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--background)]">
                    <p className="text-xs text-[var(--muted-foreground)] mb-3">Suggested questions</p>
                    <div className="space-y-2">
                      {prompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handlePromptClick(prompt.text)}
                          className="w-full text-left px-3 py-2.5 rounded-lg bg-white border border-[var(--border)] hover:border-[var(--accent-primary)] transition-all text-sm text-[var(--foreground)]"
                        >
                          {prompt.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation Area */}
                <div className="px-5 py-4 max-h-[320px] overflow-y-auto bg-white">
                  {conversation.length === 0 ? (
                    <div className="text-center py-8">
                      <Sparkles className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-3" />
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Ask me anything about {getContextLabel(context)}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {conversation.map((msg, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
                              msg.role === 'user'
                                ? 'bg-[var(--primary)] text-white'
                                : 'bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </motion.div>
                      ))}
                      
                      {/* AI Thinking */}
                      {isThinking && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-start"
                        >
                          <div className="px-4 py-2.5 rounded-lg bg-[var(--secondary)] border border-[var(--border)]">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <motion.div
                                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"
                                />
                                <motion.div
                                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"
                                />
                                <motion.div
                                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"
                                />
                              </div>
                              <span className="text-xs text-[var(--muted-foreground)]">Thinking...</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="px-5 py-4 border-t border-[var(--border)] bg-white">
                  <div className="flex items-end gap-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !isThinking && handleSend()}
                      placeholder="Ask a question..."
                      disabled={isThinking}
                      className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--accent-primary)] transition-all text-sm placeholder:text-[var(--muted-foreground)] disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!message.trim() || isThinking}
                      className="w-10 h-10 rounded-lg bg-[var(--primary)] text-white transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--accent-primary)]"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Minimized State */}
            {isMinimized && (
              <button
                onClick={() => setIsMinimized(false)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-[var(--secondary)] transition-all"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span className="text-sm text-[var(--foreground)]">Ask LeakGuard</span>
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">Click to expand</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function getContextLabel(context: string): string {
  if (context === 'landing') return 'LeakGuard and model auditing';
  if (context === 'setup') return 'audit setup and configuration';
  if (context === 'results') return 'findings and remediation';
  return 'this page';
}

function getMockResponse(message: string, context: string): string {
  const lowerMsg = message.toLowerCase();

  // Context-specific responses
  if (context === 'landing') {
    if (lowerMsg.includes('feature leakage') || lowerMsg.includes('what counts')) {
      return 'Feature leakage occurs when a feature contains information derived from the target variable or future events. This can happen through direct calculation, proxy variables, or data collection artifacts that wouldn\'t be available at true prediction time.';
    }
    if (lowerMsg.includes('temporal')) {
      return 'Temporal leakage happens when your model uses information from the future—data that wouldn\'t be available at the time you need to make a prediction. LeakGuard analyzes timestamps and data collection patterns to detect this.';
    }
    if (lowerMsg.includes('when')) {
      return 'Run an audit before trusting model results, before deployment, when validating external models, or periodically for production systems. It\'s especially important for high-stakes decisions in healthcare, finance, or compliance contexts.';
    }
  }

  if (context === 'setup') {
    if (lowerMsg.includes('prediction time')) {
      return 'The prediction time point is the exact moment when your model would make a prediction in production. For example, "at hospital discharge" or "end of business day." All features must use only data available before this point.';
    }
    if (lowerMsg.includes('observation window')) {
      return 'The observation window is the period after prediction time during which you observe whether the target event occurs. For example, "30 days post-discharge" for readmission prediction. This defines your outcome measurement period.';
    }
    if (lowerMsg.includes('split')) {
      return 'Your split method should match production deployment. Temporal splits are often safest for time-series data. Random splits can leak if temporal dependencies exist. Group-based splits prevent entity-level leakage.';
    }
  }

  if (context === 'results') {
    if (lowerMsg.includes('critical') || lowerMsg.includes('risky')) {
      return 'Critical findings indicate severe leakage that fundamentally invalidates model metrics. They typically involve future information, target derivatives, or pipeline errors that would cause dramatic performance drops in production.';
    }
    if (lowerMsg.includes('fix first') || lowerMsg.includes('priority')) {
      return 'Address critical temporal and target leakage first, as these have the highest impact. Then fix pipeline issues. Lower-severity findings can be monitored or addressed in future iterations.';
    }
    if (lowerMsg.includes('metric inflation') || lowerMsg.includes('calculated')) {
      return 'Metric inflation is estimated by analyzing feature importance, correlation patterns, and information leakage scores. We compare expected vs. observed performance and model the likely impact of removing leaked information.';
    }
  }

  // Generic fallback
  return 'I can help explain audit concepts, findings, and remediation steps. Try asking about specific terms or concepts you\'d like to understand better.';
}