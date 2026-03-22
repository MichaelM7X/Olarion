import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Shield, Clock, Network, ArrowRight, CheckCircle } from 'lucide-react';
import { AmbientBackground } from '../components/AmbientBackground';
import { FloatingChat } from '../components/FloatingChat';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';

export function Landing() {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const auditTypes = [
    {
      icon: Clock,
      title: 'Temporal Leakage',
      description: 'Detects when future information is inadvertently available at prediction time.',
    },
    {
      icon: Network,
      title: 'Feature / Proxy Leakage',
      description: 'Identifies features that are proxies for the target or contain leaked information.',
    },
    {
      icon: Shield,
      title: 'Structure / Pipeline Leakage',
      description: 'Audits data splits, transformations, and pipeline design for methodological flaws.',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Define audit context',
      description: 'Specify prediction task, time boundaries, and data structure.',
    },
    {
      number: '02',
      title: 'Run audit',
      description: 'Execute comprehensive leakage detection across all categories.',
    },
    {
      number: '03',
      title: 'Review evidence and fix plan',
      description: 'Inspect findings, understand root causes, and implement corrections.',
    },
  ];

  return (
    <div className="min-h-screen relative">
      {/* Navigation */}
      <Navigation />

      {/* Ambient background animation - centered on hero */}
      <div className="absolute top-0 left-0 right-0 h-[900px] overflow-hidden pointer-events-none">
        <AmbientBackground variant="subtle" />
      </div>
      
      {/* Hero Section */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="max-w-5xl mx-auto px-8 pt-32 pb-16 relative z-10"
      >
        <motion.div variants={fadeUpVariants} className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-primary-pale)] border border-[var(--border)] text-[var(--accent-primary)] mb-6">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Methodological Trust Layer</span>
          </div>
        </motion.div>

        <motion.h1
          variants={fadeUpVariants}
          className="font-serif text-6xl text-center mb-6 text-[var(--foreground)]"
        >
          LeakGuard
        </motion.h1>

        <motion.p
          variants={fadeUpVariants}
          className="text-xl text-center mb-4 text-[var(--foreground)] max-w-3xl mx-auto"
        >
          Audit whether your predictive model is using information it should never have seen
        </motion.p>

        <motion.p
          variants={fadeUpVariants}
          className="text-base text-center mb-12 text-[var(--muted-foreground)] max-w-2xl mx-auto"
        >
          A domain-aware leakage audit agent that detects temporal, feature, and structural leakage 
          before you trust results or deploy your model. Built for high-stakes environments where 
          methodological integrity matters.
        </motion.p>

        <motion.div
          variants={fadeUpVariants}
          className="flex items-center justify-center gap-4"
        >
          <Link
            to="/setup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--accent-primary)] transition-colors"
          >
            <span>Start Audit</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/past-audits"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
          >
            View Past Audits
          </Link>
        </motion.div>
      </motion.section>

      {/* Audit Categories */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={{
          visible: { transition: { staggerChildren: 0.15 } },
        }}
        className="max-w-5xl mx-auto px-8 py-16 relative z-10"
      >
        <motion.h2
          variants={fadeUpVariants}
          className="text-2xl text-center mb-12 text-[var(--foreground)]"
        >
          Core Audit Categories
        </motion.h2>

        <div className="grid grid-cols-3 gap-6">
          {auditTypes.map((audit, index) => (
            <motion.div
              key={index}
              variants={fadeUpVariants}
              className="bg-white/60 backdrop-blur-sm p-6 rounded-lg border border-[var(--border)] hover:border-[var(--accent-primary)] hover:bg-white/80 transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center mb-4 border border-[var(--border)]">
                <audit.icon className="w-6 h-6 text-[var(--accent-primary)]" />
              </div>
              <h3 className="text-lg mb-2 text-[var(--foreground)]">{audit.title}</h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{audit.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* How It Works Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={{
          visible: { transition: { staggerChildren: 0.15 } },
        }}
        className="max-w-5xl mx-auto px-8 py-16 relative z-10"
      >
        <motion.h2
          variants={fadeUpVariants}
          className="text-2xl text-center mb-12 text-[var(--foreground)]"
        >
          How It Works
        </motion.h2>

        <div className="grid grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={fadeUpVariants}
              className="relative"
            >
              {/* Step Number */}
              <div className="mb-4">
                <span className="text-5xl font-serif text-[var(--accent-primary)] opacity-20">
                  {step.number}
                </span>
              </div>
              
              {/* Content */}
              <h3 className="text-lg mb-3 text-[var(--foreground)]">{step.title}</h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                {step.description}
              </p>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 -right-4 w-8 h-px bg-[var(--border)]" />
              )}
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Footer */}
      <Footer />

      {/* Floating Chat Assistant */}
      <FloatingChat context="landing" />
    </div>
  );
}