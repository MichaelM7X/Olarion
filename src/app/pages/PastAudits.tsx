import { motion } from 'motion/react';
import { Link } from 'react-router';
import { FileText, Calendar, AlertTriangle, CheckCircle, ArrowRight, Clock } from 'lucide-react';
import { AmbientBackground } from '../components/AmbientBackground';
import { FloatingChat } from '../components/FloatingChat';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';

interface Audit {
  id: string;
  name: string;
  date: string;
  status: 'completed' | 'in-progress';
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
}

export function PastAudits() {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // Demo audit data
  const audits: Audit[] = [
    {
      id: 'demo-1',
      name: 'Hospital Readmission Model - Demo',
      date: 'March 22, 2026',
      status: 'completed',
      criticalFindings: 2,
      highFindings: 3,
      mediumFindings: 4,
    },
  ];

  return (
    <div className="min-h-screen relative">
      {/* Navigation */}
      <Navigation />

      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AmbientBackground variant="subtle" />
      </div>

      {/* Navigation spacing */}
      <div className="h-20" />

      {/* Page Header */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="max-w-5xl mx-auto px-8 pt-12 pb-8 relative z-10"
      >
        <motion.div variants={fadeUpVariants} className="mb-8">
          <h1 className="font-serif text-4xl mb-3 text-[var(--foreground)]">Past Audits</h1>
          <p className="text-base text-[var(--muted-foreground)] max-w-2xl">
            Review completed and in-progress audits. Access findings, evidence, and recommendations.
          </p>
        </motion.div>

        <motion.div variants={fadeUpVariants} className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 rounded-lg bg-white border border-[var(--border)]">
              <span className="text-sm text-[var(--muted-foreground)]">
                {audits.length} {audits.length === 1 ? 'audit' : 'audits'}
              </span>
            </div>
          </div>
          <Link
            to="/setup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--accent-primary)] transition-colors"
          >
            <span>New Audit</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </motion.section>

      {/* Audits List */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
        }}
        className="max-w-5xl mx-auto px-8 pb-16 relative z-10"
      >
        <div className="space-y-4">
          {audits.map((audit, index) => (
            <motion.div key={audit.id} variants={fadeUpVariants}>
              <Link
                to="/results"
                className="block bg-white rounded-lg border border-[var(--border)] p-6 hover:border-[var(--accent-primary)] hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-lg bg-[var(--secondary)] flex items-center justify-center border border-[var(--border)] group-hover:bg-[var(--accent-primary-pale)] transition-colors">
                      <FileText className="w-6 h-6 text-[var(--accent-primary)]" />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg text-[var(--foreground)] group-hover:text-[var(--accent-primary)] transition-colors">
                          {audit.name}
                        </h3>
                        {audit.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs border border-green-200">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">
                            <Clock className="w-3 h-3" />
                            In Progress
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                          <Calendar className="w-4 h-4" />
                          {audit.date}
                        </div>
                      </div>

                      {/* Findings Summary */}
                      {audit.status === 'completed' && (
                        <div className="flex items-center gap-4">
                          {audit.criticalFindings > 0 && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-[var(--muted-foreground)]">
                                {audit.criticalFindings} critical
                              </span>
                            </div>
                          )}
                          {audit.highFindings > 0 && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-[var(--muted-foreground)]">
                                {audit.highFindings} high
                              </span>
                            </div>
                          )}
                          {audit.mediumFindings > 0 && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                              <span className="text-[var(--muted-foreground)]">
                                {audit.mediumFindings} medium
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Arrow Icon */}
                  <div className="ml-4">
                    <ArrowRight className="w-5 h-5 text-[var(--muted-foreground)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Empty State (if needed in the future) */}
        {audits.length === 0 && (
          <motion.div
            variants={fadeUpVariants}
            className="bg-white rounded-lg border border-[var(--border)] p-12 text-center"
          >
            <FileText className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-4" />
            <h3 className="text-lg mb-2 text-[var(--foreground)]">No audits yet</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              Start your first audit to detect model leakage
            </p>
            <Link
              to="/setup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--accent-primary)] transition-colors"
            >
              <span>Start Audit</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </motion.section>

      {/* Footer */}
      <Footer />

      {/* Floating Chat Assistant */}
      <FloatingChat context="landing" />
    </div>
  );
}