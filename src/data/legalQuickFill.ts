/**
 * Legal demo cases for Quick Fill (Audit Setup).
 * Source of truth: test dataset/legal-clean and test dataset/legal-leaky zips.
 */

export const LEGAL_CLEAN_CSV = `case_id,defendant_age,prior_convictions,charge_severity,has_public_defender,bail_amount,num_witnesses,evidence_strength_score,pretrial_detention_days,found_guilty
C001,34,2,Felony,1,50000,3,0.82,45,1
C002,28,0,Misdemeanor,0,5000,1,0.25,0,0
C003,45,5,Felony,1,100000,6,0.91,90,1
C004,22,0,Misdemeanor,0,2000,2,0.30,0,0
C005,51,3,Felony,1,75000,4,0.85,60,1
C006,19,0,Misdemeanor,1,3000,1,0.22,5,0
C007,38,4,Felony,1,80000,5,0.88,75,1
C008,26,1,Misdemeanor,0,8000,2,0.35,0,0
C009,42,3,Felony,1,90000,4,0.86,70,1
C010,31,0,Misdemeanor,0,4000,1,0.28,0,0
C011,55,6,Felony,1,120000,7,0.93,120,1
C012,24,0,Misdemeanor,0,3500,2,0.32,0,0
C013,47,4,Felony,1,85000,5,0.89,80,1
C014,29,1,Misdemeanor,0,6000,2,0.38,0,0
C015,36,2,Felony,1,70000,3,0.80,50,1
C016,21,0,Misdemeanor,0,2500,1,0.20,0,0
C017,49,5,Felony,1,95000,6,0.90,85,1
C018,33,1,Misdemeanor,0,7000,2,0.36,0,0
C019,40,3,Felony,1,88000,4,0.87,65,1
C020,25,0,Misdemeanor,0,3000,1,0.24,0,0
C021,52,4,Felony,1,110000,5,0.92,100,1
C022,27,0,Misdemeanor,0,4500,2,0.33,0,0
C023,44,3,Felony,1,82000,4,0.84,55,1
C024,30,1,Misdemeanor,0,5500,2,0.37,0,0
C025,37,2,Felony,1,72000,3,0.81,48,1
C026,23,0,Misdemeanor,0,2800,1,0.21,0,0
C027,48,5,Felony,1,98000,6,0.91,88,1
C028,32,1,Misdemeanor,0,6500,2,0.34,0,0
C029,41,3,Felony,1,86000,4,0.85,62,1
C030,20,0,Misdemeanor,1,3200,1,0.19,3,0
C031,53,4,Felony,1,105000,5,0.90,95,1
C032,35,2,Felony,1,68000,3,0.78,42,1
C033,46,3,Felony,1,92000,5,0.88,72,1
C034,39,2,Felony,1,76000,4,0.83,58,1
C035,26,0,Misdemeanor,0,4000,1,0.26,0,0
C036,50,5,Felony,1,102000,6,0.92,92,1
C037,43,3,Felony,1,84000,4,0.86,68,1
C038,28,0,Misdemeanor,0,3800,2,0.31,0,0
C039,54,6,Felony,1,115000,7,0.94,110,1
C040,22,0,Misdemeanor,0,2200,1,0.18,0,0`;

export const LEGAL_CLEAN_PREPROCESSING = `import pandas as pd
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder

df = pd.read_csv("dataset.csv")

le = LabelEncoder()
df["charge_severity"] = le.fit_transform(df["charge_severity"])

X = df.drop(columns=["case_id", "found_guilty"])
y = df["found_guilty"]

# GroupKFold split by case_id — no entity leakage
gkf = GroupKFold(n_splits=5)
for train_idx, test_idx in gkf.split(X, y, groups=df["case_id"]):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

# Scaler fitted ONLY on training data
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)
`;

export const LEGAL_CLEAN_CONFIG = {
  prediction_goal: 'Predict whether a defendant will be found guilty in a criminal case.',
  target_column: 'found_guilty',
  csv_filename: 'dataset.csv',
} as const;

export const LEGAL_LEAKY_CSV = `case_id,defendant_age,prior_convictions,charge_severity,has_public_defender,bail_amount,num_witnesses,sentence_length_months,appeal_filed,judge_leniency_score,avg_defendant_guilt_rate,found_guilty
C001,34,2,Felony,1,50000,3,24,0,0.35,0.72,1
C002,28,0,Misdemeanor,0,5000,1,0,0,0.65,0.18,0
C003,45,5,Felony,1,100000,6,60,1,0.25,0.85,1
C004,22,0,Misdemeanor,0,2000,2,0,0,0.70,0.10,0
C005,51,3,Felony,1,75000,4,36,0,0.30,0.78,1
C006,19,0,Misdemeanor,1,3000,1,0,0,0.60,0.15,0
C007,38,4,Felony,1,80000,5,48,1,0.28,0.82,1
C008,26,1,Misdemeanor,0,8000,2,0,0,0.55,0.22,0
C009,42,3,Felony,1,90000,4,42,0,0.32,0.80,1
C010,31,0,Misdemeanor,0,4000,1,0,0,0.68,0.12,0
C011,55,6,Felony,1,120000,7,72,1,0.22,0.88,1
C012,24,0,Misdemeanor,0,3500,2,0,0,0.62,0.14,0
C013,47,4,Felony,1,85000,5,54,0,0.27,0.83,1
C014,29,1,Misdemeanor,0,6000,2,0,0,0.58,0.20,0
C015,36,2,Felony,1,70000,3,30,1,0.33,0.75,1
C016,21,0,Misdemeanor,0,2500,1,0,0,0.72,0.08,0
C017,49,5,Felony,1,95000,6,66,1,0.24,0.86,1
C018,33,1,Misdemeanor,0,7000,2,0,0,0.56,0.21,0
C019,40,3,Felony,1,88000,4,40,0,0.30,0.79,1
C020,25,0,Misdemeanor,0,3000,1,0,0,0.66,0.11,0
C021,52,4,Felony,1,110000,5,58,1,0.26,0.84,1
C022,27,0,Misdemeanor,0,4500,2,0,0,0.63,0.16,0
C023,44,3,Felony,1,82000,4,44,0,0.31,0.77,1
C024,30,1,Misdemeanor,0,5500,2,0,0,0.59,0.19,0
C025,37,2,Felony,1,72000,3,32,0,0.34,0.74,1
C026,23,0,Misdemeanor,0,2800,1,0,0,0.69,0.09,0
C027,48,5,Felony,1,98000,6,62,1,0.23,0.87,1
C028,32,1,Misdemeanor,0,6500,2,0,0,0.57,0.20,0
C029,41,3,Felony,1,86000,4,46,0,0.29,0.81,1
C030,20,0,Misdemeanor,1,3200,1,0,0,0.71,0.07,0
C031,53,4,Felony,1,105000,5,56,0,0.25,0.83,1
C032,35,2,Felony,1,68000,3,28,1,0.36,0.73,1
C033,46,3,Felony,1,92000,5,50,0,0.28,0.80,1
C034,39,2,Felony,1,76000,4,38,1,0.31,0.76,1
C035,26,0,Misdemeanor,0,4000,1,0,0,0.64,0.13,0
C036,50,5,Felony,1,102000,6,64,1,0.24,0.85,1
C037,43,3,Felony,1,84000,4,42,0,0.30,0.79,1
C038,28,0,Misdemeanor,0,3800,2,0,0,0.61,0.15,0
C039,54,6,Felony,1,115000,7,70,1,0.23,0.87,1
C040,22,0,Misdemeanor,0,2200,1,0,0,0.73,0.06,0`;

export const LEGAL_LEAKY_PREPROCESSING = `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder

df = pd.read_csv("dataset.csv")

# Compute average guilt rate per defendant across ALL cases (including future outcomes)
df["avg_defendant_guilt_rate"] = df.groupby("case_id")["found_guilty"].transform("mean")

le = LabelEncoder()
df["charge_severity"] = le.fit_transform(df["charge_severity"])

feature_cols = [
    "defendant_age", "prior_convictions", "charge_severity",
    "has_public_defender", "bail_amount", "num_witnesses",
    "sentence_length_months", "appeal_filed",
    "judge_leniency_score", "avg_defendant_guilt_rate"
]

# Fit scaler on ALL data before splitting
scaler = StandardScaler()
df[feature_cols] = scaler.fit_transform(df[feature_cols])

X = df[feature_cols]
y = df["found_guilty"]

# Random split — no grouping by case_id
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
`;

export const LEGAL_LEAKY_CONFIG = {
  prediction_goal: 'Predict whether a defendant will be found guilty in a criminal case.',
  target_column: 'found_guilty',
  csv_filename: 'dataset.csv',
} as const;
