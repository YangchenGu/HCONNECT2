export const detailFilters = {
  timeRangeOptions: ["Today", "7 days", "30 days", "90 days"],
  cohortOptions: ["All patients", "High risk", "Diabetes", "Hypertension"],
  statusOptions: ["Any", "Active", "Inactive"],
  riskOptions: ["Any", "High", "Medium", "Low"],
};

export const reportRows = [
  {
    id: "R-1001",
    patientId: "P-1001",
    patientName: "Jane Smith",
    condition: "Hypertension",
    risk: "High",
    status: "Active",
    lastUpdate: "Today",
    avgScore: 62,
    flags: ["BP high", "Sleep low"],
    notes: "Recommend follow-up within 48h.",
  },
  {
    id: "R-1002",
    patientId: "P-1002",
    patientName: "Tony Reed",
    condition: "Type 2 Diabetes",
    risk: "Medium",
    status: "Active",
    lastUpdate: "Yesterday",
    avgScore: 74,
    flags: ["Glucose trend"],
    notes: "Review diet plan and recheck in 1 week.",
  },
  {
    id: "R-1003",
    patientId: "P-1003",
    patientName: "Alicia Park",
    condition: "No condition",
    risk: "Low",
    status: "Inactive",
    lastUpdate: "3 days ago",
    avgScore: 81,
    flags: [],
    notes: "Stable. Next scheduled check.",
  },
  {
    id: "R-1004",
    patientId: "P-1004",
    patientName: "Sam Lee",
    condition: "Hypertension",
    risk: "Medium",
    status: "Active",
    lastUpdate: "Today",
    avgScore: 69,
    flags: ["Stress high"],
    notes: "Consider stress management interventions.",
  },
];

export const detailKpis = [
  { label: "Reports generated", value: "34", sub: "Selected range" },
  { label: "Patients covered", value: "70", sub: "Selected cohort" },
  { label: "High risk", value: "12", sub: "Needs attention" },
  { label: "Avg health score", value: "72", sub: "Demo metric" },
];
