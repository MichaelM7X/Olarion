import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import {
  CheckCircle,
  Loader2,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Brain,
  Search,
  Shield,
  Code,
  FileSearch,
  Bot,
  FileText,
} from 'lucide-react';
import type { ThinkingStep } from '../../lib/llmEngine';

const STEP_ICONS: Record<string, typeof Search> = {
  'pipeline-scan': Search,
  'proxy-detector': Shield,
  'temporal-detector': FileSearch,
  'code-auditor': Code,
  'model-auditor': Code,
  'structural-check': Search,
  'review-agent': Bot,
  'report-gen': FileText,
};

function StepIcon({ stepId, status }: { stepId: string; status: string }) {
  if (status === 'running') {
    return <Loader2 className="w-4 h-4 text-[var(--accent-primary)] animate-spin" />;
  }
  if (status === 'done') {
    return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  }
  if (status === 'skipped') {
    return <SkipForward className="w-4 h-4 text-[var(--muted-foreground)]" />;
  }
  const Icon = STEP_ICONS[stepId] ?? Search;
  return <Icon className="w-4 h-4 text-[var(--muted-foreground)]" />;
}

function StatusDot({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent-primary)] opacity-75 animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent-primary)]" />
      </span>
    );
  }
  if (status === 'done') {
    return <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />;
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />;
}

export function AuditThinking({ steps }: { steps: ThinkingStep[] }) {
  const [expanded, setExpanded] = useState(true);
  const activeCount = steps.filter((s) => s.status === 'running').length;
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const totalSteps = steps.length;
  const currentStep = [...steps].reverse().find((s) => s.status === 'running');
  const latestDone = [...steps].reverse().find((s) => s.status === 'done');

  const uniqueSteps = steps.reduce<ThinkingStep[]>((acc, step) => {
    const idx = acc.findIndex((s) => s.id === step.id);
    if (idx >= 0) {
      acc[idx] = step;
    } else {
      acc.push(step);
    }
    return acc;
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto w-full"
    >
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-lg overflow-hidden">
        {/* Header - always visible */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--secondary)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="w-5 h-5 text-[var(--accent-primary)]" />
              {activeCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent-primary)] opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent-primary)]" />
                </span>
              )}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {activeCount > 0 ? 'Agent is thinking…' : 'Processing complete'}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {currentStep?.title ?? latestDone?.title ?? 'Initializing…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--muted-foreground)] tabular-nums">
              {doneCount}/{totalSteps > 0 ? totalSteps : '?'}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
            )}
          </div>
        </button>

        {/* Progress bar */}
        <div className="h-0.5 bg-[var(--secondary)]">
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-blue-400"
            initial={{ width: '0%' }}
            animate={{ width: totalSteps > 0 ? `${(doneCount / totalSteps) * 100}%` : '5%' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Expandable step list */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 py-4 space-y-1">
                {uniqueSteps.map((step, i) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.2 }}
                    className="flex items-start gap-3 py-2"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <StepIcon stepId={step.id} status={step.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm ${
                            step.status === 'running'
                              ? 'text-[var(--foreground)] font-medium'
                              : step.status === 'skipped'
                                ? 'text-[var(--muted-foreground)] line-through'
                                : 'text-[var(--foreground)]'
                          }`}
                        >
                          {step.title}
                        </p>
                        <StatusDot status={step.status} />
                      </div>
                      {step.detail && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`text-xs mt-0.5 ${
                            step.status === 'running'
                              ? 'text-[var(--accent-primary)]'
                              : 'text-[var(--muted-foreground)]'
                          }`}
                        >
                          {step.detail}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                ))}

                {activeCount > 0 && (
                  <motion.div
                    className="flex items-center gap-2 pt-2 border-t border-[var(--border)] mt-2"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Working on it…
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
