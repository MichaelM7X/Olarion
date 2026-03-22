import { motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Upload, FileText, Code, AlertCircle, Clock, Network, Shield, Archive, CheckCircle2, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { FloatingChat } from '../components/FloatingChat';
import { AmbientBackground } from '../components/AmbientBackground';
import { extractCsvColumns } from '../lib/csv';
import type { AuditRequest } from '../../types';

export function AuditSetup() {
  const navigate = useNavigate();
  const [taskDescription, setTaskDescription] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [preprocessingCode, setPreprocessingCode] = useState('');
  const [trainingCode, setTrainingCode] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zipProcessing, setZipProcessing] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setZipProcessing(true);
    setZipStatus('Reading ZIP file…');
    setSubmitError(null);

    try {
      const zip = await JSZip.loadAsync(file);
      const csvFiles: { name: string; file: JSZip.JSZipObject }[] = [];
      const pyFiles: { name: string; file: JSZip.JSZipObject }[] = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        const name = relativePath.split('/').pop() ?? relativePath;
        if (name.startsWith('.') || name.startsWith('__')) return;
        if (name.endsWith('.csv')) csvFiles.push({ name, file: zipEntry });
        if (name.endsWith('.py')) pyFiles.push({ name, file: zipEntry });
      });

      if (csvFiles.length === 0) {
        setSubmitError('No .csv file found in the ZIP.');
        setZipProcessing(false);
        setZipStatus(null);
        return;
      }
      if (pyFiles.length === 0) {
        setSubmitError('No .py file found in the ZIP.');
        setZipProcessing(false);
        setZipStatus(null);
        return;
      }

      setZipStatus('Extracting CSV…');
      const csvContent = await csvFiles[0].file.async('blob');
      const csvFileObj = new File([csvContent], csvFiles[0].name, { type: 'text/csv' });
      setDatasetFile(csvFileObj);

      setZipStatus('Reading Python files…');
      const pyContents = await Promise.all(
        pyFiles.map(async (pf) => ({
          filename: pf.name,
          content: await pf.file.async('string'),
        })),
      );

      if (pyContents.length === 1) {
        setPreprocessingCode(pyContents[0].content);
        setTrainingCode('');
        setZipStatus(null);
      } else {
        setZipStatus('Classifying code files with LLM…');
        const resp = await fetch('http://localhost:3001/api/classify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: pyContents }),
        });
        if (!resp.ok) throw new Error('Code classification API failed');
        const result = await resp.json();
        setPreprocessingCode(result.preprocessing_code ?? '');
        setTrainingCode(result.model_training_code ?? '');
        setZipStatus(null);
      }

      setZipStatus(`Done — extracted ${csvFiles[0].name} + ${pyFiles.length} code file(s)`);
      setTimeout(() => setZipStatus(null), 4000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to process ZIP file.');
      setZipStatus(null);
    } finally {
      setZipProcessing(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!datasetFile) {
      setSubmitError('Please upload a training CSV.');
      return;
    }

    setIsSubmitting(true);
    try {
      const csv_columns = await extractCsvColumns(datasetFile);
      const target = targetColumn.trim();
      if (!csv_columns.includes(target)) {
        setSubmitError(
          `Target column "${target}" is not in the CSV header. Headers found: ${csv_columns.join(', ')}`,
        );
        return;
      }

      const request: AuditRequest = {
        prediction_goal: taskDescription.trim(),
        target_column: target,
        csv_columns,
        preprocessing_code: preprocessingCode.trim(),
        model_training_code: trainingCode.trim() || undefined,
      };

      navigate('/results', { state: { request } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not read the CSV file.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    taskDescription.trim() !== '' &&
    targetColumn.trim() !== '' &&
    datasetFile !== null &&
    preprocessingCode.trim() !== '' &&
    !isSubmitting;

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

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

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-12 relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {/* Page Header */}
          <motion.div variants={fadeUpVariants} className="mb-12">
            <h1 className="text-3xl mb-3 text-[var(--foreground)]">Audit Setup</h1>
            <p className="text-base text-[var(--muted-foreground)] max-w-2xl">
              Provide your prediction task details and data artifacts. The agent will audit for temporal, feature, and pipeline leakage.
            </p>
          </motion.div>

          <div className="grid grid-cols-3 gap-8">
            {/* Main Form - Left Column (2 cols) */}
            <div className="col-span-2 space-y-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Quick Upload */}
                <motion.div variants={fadeUpVariants}>
                  <div className="mb-4">
                    <h2 className="text-lg text-[var(--foreground)] mb-2">Quick Upload</h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Upload a ZIP containing your CSV dataset and Python code files. The system will auto-detect which file is which.
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleZipUpload}
                      disabled={zipProcessing}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div
                      className={`border-2 border-dashed rounded-lg px-6 py-6 text-center transition-all ${
                        zipProcessing
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-pale)]'
                          : 'border-[var(--border)] bg-white hover:border-[var(--accent-primary)] hover:bg-[var(--secondary)]'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {zipProcessing ? (
                          <Loader2 className="w-6 h-6 text-[var(--accent-primary)] animate-spin" />
                        ) : (
                          <Archive className="w-6 h-6 text-[var(--muted-foreground)]" />
                        )}
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {zipProcessing ? zipStatus : 'Drop a ZIP file here, or click to browse'}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Must contain at least one .csv and one .py file
                        </p>
                      </div>
                    </div>
                  </div>
                  {zipStatus && !zipProcessing && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      {zipStatus}
                    </div>
                  )}
                </motion.div>

                <div className="relative flex items-center gap-4 py-2">
                  <div className="flex-1 border-t border-[var(--border)]" />
                  <span className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">or fill in manually</span>
                  <div className="flex-1 border-t border-[var(--border)]" />
                </div>

                {/* Required Inputs Section */}
                <motion.div variants={fadeUpVariants}>
                  <div className="mb-6">
                    <h2 className="text-lg text-[var(--foreground)] mb-2">Required Inputs</h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      These inputs are needed to run the audit. Fill manually or use ZIP upload above.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* Prediction Task Description */}
                    <div>
                      <label className="block text-sm text-[var(--foreground)] mb-2">
                        Prediction task description
                        <span className="text-[var(--risk-critical)] ml-1">*</span>
                      </label>
                      <textarea
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        placeholder="Example: Predict 30-day hospital readmission for heart failure patients at discharge time"
                        className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--accent-primary)] transition-all resize-none text-sm"
                        rows={3}
                        required
                      />
                      <p className="text-xs text-[var(--muted-foreground)] mt-2">
                        Describe what you're predicting and when the prediction is made
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm text-[var(--foreground)] mb-2">
                        Target column name
                        <span className="text-[var(--risk-critical)] ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        value={targetColumn}
                        onChange={(e) => setTargetColumn(e.target.value)}
                        placeholder="Must match the CSV header exactly (e.g. readmitted_30d)"
                        className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--accent-primary)] transition-all text-sm font-mono"
                        required
                      />
                      <p className="text-xs text-[var(--muted-foreground)] mt-2">
                        Same spelling as the outcome column in your uploaded CSV
                      </p>
                    </div>

                    {/* CSV Dataset */}
                    <div>
                      <label className="block text-sm text-[var(--foreground)] mb-2">
                        Training dataset (CSV)
                        <span className="text-[var(--risk-critical)] ml-1">*</span>
                      </label>
                      <FileUploadArea
                        file={datasetFile}
                        onFileSelect={setDatasetFile}
                        accept=".csv"
                        placeholder="Upload CSV file or drag and drop"
                      />
                      <p className="text-xs text-[var(--muted-foreground)] mt-2">
                        Your training data with features and target variable
                      </p>
                    </div>

                    {/* Preprocessing Code */}
                    <div>
                      <label className="block text-sm text-[var(--foreground)] mb-2">
                        Preprocessing code
                        <span className="text-[var(--risk-critical)] ml-1">*</span>
                      </label>
                      <CodeInput
                        value={preprocessingCode}
                        onChange={setPreprocessingCode}
                        placeholder="# Paste your feature engineering and preprocessing code here
# Example:
# df['age_at_admission'] = (df['admission_date'] - df['birth_date']).dt.days / 365
# df['readmission_flag'] = df['readmission_date'].notna()"
                      />
                      <p className="text-xs text-[var(--muted-foreground)] mt-2">
                        Feature engineering, transformations, and data cleaning steps
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Optional Input Section */}
                <motion.div variants={fadeUpVariants}>
                  <div className="mb-6 pt-6 border-t border-[var(--border)]">
                    <h2 className="text-lg text-[var(--foreground)] mb-2">Optional Input</h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Providing this helps detect additional pipeline-level leakage.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--muted-foreground)] mb-2">
                      Model training code
                    </label>
                    <CodeInput
                      value={trainingCode}
                      onChange={setTrainingCode}
                      placeholder="# Optional: paste your model training and evaluation code
# Example:
# from sklearn.model_selection import train_test_split
# X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
# model.fit(X_train, y_train)"
                      rows={6}
                    />
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">
                      Train/test split logic, model fitting, and evaluation code
                    </p>
                  </div>
                </motion.div>

                {/* Submit Button */}
                <motion.div variants={fadeUpVariants} className="pt-6">
                  {submitError && (
                    <p className="text-sm text-[var(--risk-critical)] mb-4 px-1" role="alert">
                      {submitError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={`w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-lg text-white transition-all ${
                      canSubmit
                        ? 'bg-[var(--primary)] hover:bg-[var(--accent-primary)] cursor-pointer'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <span className="font-medium">{isSubmitting ? 'Preparing…' : 'Run Audit'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  {!canSubmit && !isSubmitting && (
                    <p className="text-xs text-[var(--muted-foreground)] text-center mt-3">
                      Complete all required fields to run the audit
                    </p>
                  )}
                </motion.div>
              </form>
            </div>

            {/* Info Panel - Right Column */}
            <motion.div variants={fadeUpVariants} className="col-span-1">
              <div className="bg-white rounded-lg border border-[var(--border)] p-6 sticky top-28">
                <h3 className="text-base text-[var(--foreground)] mb-4">What the agent audits</h3>
                
                <div className="space-y-4">
                  <AuditTypeCard
                    icon={Clock}
                    title="Temporal Leakage"
                    description="Detects features using post-prediction information"
                  />
                  <AuditTypeCard
                    icon={Network}
                    title="Feature / Proxy Leakage"
                    description="Identifies target proxies and leaked variables"
                  />
                  <AuditTypeCard
                    icon={Shield}
                    title="Pipeline Leakage"
                    description="Audits train/test splits and transformations"
                  />
                </div>

                <div className="mt-6 pt-6 border-t border-[var(--border)]">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                        The audit typically completes in 2-5 minutes depending on dataset size and complexity.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Floating Chat Assistant */}
      <FloatingChat context="setup" />
    </div>
  );
}

// File Upload Component
function FileUploadArea({
  file,
  onFileSelect,
  accept,
  placeholder,
}: {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept: string;
  placeholder: string;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    onFileSelect(selectedFile);
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        required={!file}
      />
      <div
        className={`border-2 border-dashed rounded-lg px-6 py-8 text-center transition-all ${
          file
            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-pale)]'
            : 'border-[var(--border)] bg-white hover:border-[var(--accent-primary)] hover:bg-[var(--secondary)]'
        }`}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-5 h-5 text-[var(--accent-primary)]" />
            <div className="text-left">
              <p className="text-sm text-[var(--foreground)]">{file.name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-6 h-6 text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">{placeholder}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Code Input Component
function CodeInput({
  value,
  onChange,
  placeholder,
  rows = 8,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div className="relative">
      <div className="absolute top-3 left-3 z-10">
        <Code className="w-4 h-4 text-[var(--muted-foreground)]" />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 rounded-lg border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--accent-primary)] transition-all resize-none font-mono text-xs"
        rows={rows}
        style={{ fontFamily: 'ui-monospace, monospace' }}
      />
    </div>
  );
}

// Audit Type Card Component
function AuditTypeCard({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-[var(--secondary)] flex items-center justify-center flex-shrink-0 border border-[var(--border)]">
        <Icon className="w-4 h-4 text-[var(--accent-primary)]" />
      </div>
      <div>
        <h4 className="text-sm text-[var(--foreground)] mb-1">{title}</h4>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}