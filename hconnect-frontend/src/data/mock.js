export const kpis = [
  { label: "Total Patient Monitored", value: "120", sub: "Last 30 days" },
  { label: "Active Patients", value: "85", sub: "Currently monitored" },
  { label: "Recent Activities", value: "35", sub: "Today" },
  { label: "Average Health Score", value: "72", sub: "+2 vs last week" },
];

export const patients = [
  { id: "P-1001", name: "Jane Smith", risk: "High", status: "Active", lastUpdate: "Today", score: 62 },
  { id: "P-1002", name: "Tony Reed", risk: "Medium", status: "Active", lastUpdate: "Yesterday", score: 74 },
  { id: "P-1003", name: "Alicia Park", risk: "Low", status: "Inactive", lastUpdate: "3 days ago", score: 81 },
  { id: "P-1004", name: "Sam Lee", risk: "Medium", status: "Active", lastUpdate: "Today", score: 69 },
];

export const alerts = {
  high: [
    { id: "A-1", text: "Patient Jane Smith’s blood pressure is critically high.", time: "25-May-2024 08:30AM" },
    { id: "A-2", text: "Patient Tony Reed’s glucose trend is abnormal.", time: "25-May-2024 09:10AM" },
  ],
  low: [
    { id: "A-3", text: "Reminder: Follow up on Jane Smith’s medication adherence.", time: "25-May-2024 10:00AM" },
  ],
};

export const patientOverview = [
  { name: "Jane Smith", note: "BP high • follow-up", tag: "High" },
  { name: "Tony Reed", note: "Glucose trend abnormal", tag: "Medium" },
  { name: "Alicia Park", note: "Stable • next check", tag: "Low" },
];
