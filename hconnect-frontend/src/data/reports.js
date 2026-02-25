export const reportFilters = {
  timeRangeOptions: ["Today", "7 days", "30 days", "90 days"],
  cohortOptions: ["All patients", "High risk", "Diabetes", "Hypertension"],
};

export const wellbeingFactors = [
  { key: "Stress", value: 10, max: 14, trend: "+1.2" },
  { key: "Sleep", value: 14, max: 14, trend: "-0.4" },
  { key: "Nutrition", value: 3, max: 14, trend: "+0.2" },
  { key: "Movement", value: 12, max: 14, trend: "+0.8" },
  { key: "Obesity", value: 1, max: 14, trend: "0.0" },
  { key: "Wellness", value: 1, max: 14, trend: "+0.1" },
  { key: "Depression", value: 7, max: 14, trend: "-0.3" },
  { key: "Smoke", value: 1, max: 14, trend: "-0.1" },
];

export const conditionSummary = [
  { label: "No condition", count: 46 },
  { label: "Hypertension", count: 12 },
  { label: "Stroke", count: 2 },
  { label: "Type 1 Diabetes", count: 5 },
  { label: "Type 2 Diabetes", count: 5 },
];

export const preExistingByFactor = [
  { factor: "Sleep", count: 395 },
  { factor: "Smoke", count: 96 },
  { factor: "Movement", count: 659 },
  { factor: "Nutrition", count: 164 },
];

export const improvementRates = [
  { factor: "Movement", rate: 12 },
  { factor: "Sleep", rate: 3 },
  { factor: "Smoke", rate: 2 },
  { factor: "Nutrition", rate: 8 },
];

export const insights = [
  { title: "Top driver", body: "Movement correlates with strongest improvements across the cohort." },
  { title: "Watchlist", body: "Stress and Depression remain elevated for a subset of patients." },
  { title: "Action", body: "Prioritize sleep hygiene + nutrition interventions for high-risk group." },
];
