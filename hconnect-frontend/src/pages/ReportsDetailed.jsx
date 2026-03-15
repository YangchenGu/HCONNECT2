import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../lib/api.js";

const TREND_METRICS = [
  { name: "Blood Pressure Systolic", shortLabel: "Systolic BP", unit: "mmHg", color: "#60a5fa" },
  { name: "Blood Pressure Diastolic", shortLabel: "Diastolic BP", unit: "mmHg", color: "#22d3ee" },
  { name: "Weight", shortLabel: "Weight", unit: "kg", color: "#34d399" },
  { name: "Sleep Duration", shortLabel: "Sleep Duration", unit: "h", color: "#f59e0b" },
  { name: "Sleep Quality", shortLabel: "Sleep Quality", unit: "score", color: "#c084fc" },
  { name: "Pain Level", shortLabel: "Pain Level", unit: "score", color: "#fb7185" },
];

function toDateKey(value) {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recentDayKeys(days = 7) {
  const now = new Date();
  const keys = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    keys.push(toDateKey(d));
  }
  return keys;
}

function formatDayLabel(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function buildTrendSeries(records, dayKeys) {
  const latestByMetricAndDay = new Map();

  for (const row of records) {
    const metricName = String(row.metric_name || "").toLowerCase();
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;

    const dayKey = toDateKey(row.recorded_at);
    if (!dayKeys.includes(dayKey)) continue;

    if (!latestByMetricAndDay.has(metricName)) {
      latestByMetricAndDay.set(metricName, new Map());
    }
    const dayMap = latestByMetricAndDay.get(metricName);
    const nextTimestamp = new Date(row.recorded_at).getTime();
    const previous = dayMap.get(dayKey);
    if (!previous || nextTimestamp >= previous.timestamp) {
      dayMap.set(dayKey, { value, timestamp: nextTimestamp });
    }
  }

  return TREND_METRICS.map((metric) => {
    const metricMap = latestByMetricAndDay.get(metric.name.toLowerCase()) || new Map();
    const points = dayKeys.map((dayKey) => ({
      dateKey: dayKey,
      value: metricMap.has(dayKey) ? metricMap.get(dayKey).value : null,
    }));
    const nums = points.map((p) => p.value).filter((v) => v !== null);
    const average = nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : null;

    return {
      ...metric,
      points,
      average,
    };
  });
}

function buildPath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function formatTick(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 100) return String(Math.round(value));
  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatPointValue(value) {
  if (!Number.isFinite(value)) return "";
  return value % 1 === 0 ? String(value) : (Math.round(value * 10) / 10).toFixed(1);
}

function formatAverage(value, unit) {
  if (value === null || Number.isNaN(value)) return "No data";
  const num = value % 1 === 0 ? String(value) : (Math.round(value * 10) / 10).toFixed(1);
  return unit ? `${num} ${unit}` : num;
}

function MetricTrendChart({ metric, index }) {
  const width = 360;
  const height = 150;
  const paddingLeft = 36;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const stepX = metric.points.length > 1 ? chartWidth / (metric.points.length - 1) : chartWidth;

  const values = metric.points.map((point) => point.value).filter((value) => value !== null);
  const hasData = values.length > 0;

  let min = hasData ? Math.min(...values) : 0;
  let max = hasData ? Math.max(...values) : 1;
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const basePadding = (max - min) * 0.1;
  const domainMin = Math.max(0, min - basePadding);
  const domainMax = max + basePadding;

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, tickIndex) => {
    const ratio = tickIndex / yTickCount;
    const value = domainMin + (domainMax - domainMin) * ratio;
    return {
      value,
      y: paddingTop + chartHeight - ratio * chartHeight,
    };
  });

  const toY = (value) => {
    const normalized = (value - domainMin) / (domainMax - domainMin);
    return paddingTop + chartHeight - normalized * chartHeight;
  };

  const plotted = metric.points.map((point, pointIndex) => {
    if (point.value === null) return null;
    return {
      ...point,
      x: paddingLeft + pointIndex * stepX,
      y: toY(point.value),
      pointIndex,
    };
  });

  const segments = [];
  let current = [];
  for (const point of plotted) {
    if (point) {
      current.push(point);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);

  return (
    <article className="rounded-2xl border border-violet-300/15 bg-[#1a1335] p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm text-violet-100 font-medium">{metric.shortLabel}</div>
        <div className="text-xs text-violet-300/80">Avg 7d: {formatAverage(metric.average, metric.unit)}</div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`${metric.shortLabel} trend in last 7 days`}>
        {yTicks.map((tick) => (
          <g key={`${metric.name}-ytick-${tick.y.toFixed(2)}`}>
            <line
              x1={paddingLeft}
              y1={tick.y}
              x2={paddingLeft + chartWidth}
              y2={tick.y}
              stroke="rgba(167,139,250,0.18)"
              strokeWidth="1"
            />
            <text x={paddingLeft - 6} y={tick.y + 3} textAnchor="end" fill="rgba(196,181,253,0.8)" fontSize="10">
              {formatTick(tick.value)}
            </text>
          </g>
        ))}

        {segments.map((segment, segmentIndex) => (
          <path
            key={`${metric.name}-seg-${segmentIndex}`}
            d={buildPath(segment)}
            fill="none"
            stroke={metric.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
            className="history-trend-line"
            style={{ animationDelay: `${index * 120 + segmentIndex * 90}ms` }}
          />
        ))}

        {plotted.map((point) =>
          point ? <circle key={`${metric.name}-${point.dateKey}`} cx={point.x} cy={point.y} r="3" fill={metric.color} /> : null
        )}

        {plotted.map((point) => {
          if (!point) return null;
          const placeAbove = point.y > paddingTop + chartHeight / 2;
          const direction = placeAbove ? -1 : 1;
          const jitter = point.pointIndex % 2 === 0 ? 0 : 7;
          return (
            <text
              key={`${metric.name}-value-${point.dateKey}`}
              x={point.x}
              y={point.y + direction * (9 + jitter)}
              textAnchor="middle"
              fill={metric.color}
              fontSize="10"
              fontWeight="600"
            >
              {formatPointValue(point.value)}
            </text>
          );
        })}

        {metric.points.map((point, pointIndex) => (
          <text
            key={`${metric.name}-x-${point.dateKey}`}
            x={paddingLeft + pointIndex * stepX}
            y={height - 8}
            textAnchor="middle"
            fill="rgba(196,181,253,0.8)"
            fontSize="10"
          >
            {formatDayLabel(point.dateKey)}
          </text>
        ))}

        {!hasData ? (
          <text x={width / 2} y={paddingTop + chartHeight / 2} textAnchor="middle" fill="rgba(196,181,253,0.8)" fontSize="12">
            No data in last 7 days
          </text>
        ) : null}
      </svg>
    </article>
  );
}

function normalizeReportGroups(reportSlots, reportRecords) {
  const recordsByTime = new Map();
  for (const row of reportRecords || []) {
    const key = String(row.recorded_at || "");
    if (!recordsByTime.has(key)) recordsByTime.set(key, []);
    recordsByTime.get(key).push(row);
  }

  return (reportSlots || []).map((slot) => {
    const key = String(slot.recorded_at || "");
    const metrics = (recordsByTime.get(key) || []).map((row) => ({
      metricName: row.metric_name || "Metric",
      value: row.value,
      unit: row.metric_unit || "",
    }));
    return {
      recordedAt: key,
      note: slot.notes || "",
      metricCount: slot.metric_count || metrics.length,
      metrics,
    };
  });
}

export default function ReportsDetailed() {
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const [searchParams] = useSearchParams();
  const patientId = Number(searchParams.get("patientId"));
  const validPatientId = Number.isInteger(patientId) && patientId > 0 ? patientId : null;

  const [patient, setPatient] = useState(null);
  const [averages, setAverages] = useState([]);
  const [trendRecords, setTrendRecords] = useState([]);
  const [reportSlots, setReportSlots] = useState([]);
  const [reportRecords, setReportRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 7, total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedReportId, setExpandedReportId] = useState("");
  const [adviceContent, setAdviceContent] = useState("");
  const [adviceUrgency, setAdviceUrgency] = useState("normal");
  const [submittingAdvice, setSubmittingAdvice] = useState(false);
  const [adviceMessage, setAdviceMessage] = useState("");
  const [adviceMessageType, setAdviceMessageType] = useState("success");
  const [adviceHistory, setAdviceHistory] = useState([]);
  const [advicePagination, setAdvicePagination] = useState({ page: 1, limit: 5, total: 0, pages: 1 });
  const [adviceLoading, setAdviceLoading] = useState(false);

  const dayKeys = useMemo(() => recentDayKeys(7), []);
  const trendSeries = useMemo(() => buildTrendSeries(trendRecords, dayKeys), [trendRecords, dayKeys]);
  const groupedReports = useMemo(() => normalizeReportGroups(reportSlots, reportRecords), [reportSlots, reportRecords]);

  async function loadDetail(nextPage = 1) {
    if (!validPatientId) return;
    setLoading(true);
    setError("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/doctor/reports/patients/${validPatientId}?limit=7&page=${nextPage}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load patient report detail");

      setPatient(payload.patient || null);
      setAverages(payload.averages || []);
      setTrendRecords(payload.trendRecords || []);
      setReportSlots(payload.reportSlots || []);
      setReportRecords(payload.reportRecords || []);
      setPagination(payload.pagination || { page: 1, limit: 7, total: 0, pages: 1 });
      setExpandedReportId("");
    } catch (err) {
      setError(err.message || "Failed to load patient report detail");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!validPatientId) return;
    loadDetail(1);
    loadAdviceHistory(1);
  }, [validPatientId, getAccessTokenSilently]);

  async function loadAdviceHistory(nextPage = 1) {
    if (!validPatientId) return;
    setAdviceLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/doctor/patients/${validPatientId}/advices?limit=5&page=${nextPage}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load advice history");
      setAdviceHistory(payload.advices || []);
      setAdvicePagination(payload.pagination || { page: 1, limit: 5, total: 0, pages: 1 });
    } catch (err) {
      setAdviceMessageType("error");
      setAdviceMessage(err.message || "Failed to load advice history");
    } finally {
      setAdviceLoading(false);
    }
  }

  async function submitAdvice(event) {
    event.preventDefault();
    if (!validPatientId || !adviceContent.trim()) return;

    setSubmittingAdvice(true);
    setAdviceMessage("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/doctor/patients/${validPatientId}/advices`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: adviceContent.trim(),
          urgency: adviceUrgency,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to submit advice");

      setAdviceMessageType("success");
      setAdviceMessage("Advice submitted successfully.");
      setAdviceContent("");
      setAdviceUrgency("normal");
      await loadAdviceHistory(1);
    } catch (err) {
      setAdviceMessageType("error");
      setAdviceMessage(err.message || "Failed to submit advice");
    } finally {
      setSubmittingAdvice(false);
    }
  }

  return (
    <div className="p-6 space-y-4 text-violet-100">
      <style>{`
        @keyframes historyDrawLine {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
        .history-trend-line {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: historyDrawLine 900ms ease-out forwards;
        }
      `}</style>

      <button
        type="button"
        onClick={() => navigate("/reports/overview")}
        className="rounded-xl border border-violet-300/20 bg-violet-900/35 hover:bg-violet-900/50 text-violet-100 px-3 py-2 text-sm"
      >
        Back
      </button>

      {!validPatientId ? (
        <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 text-sm text-violet-200">
          Select a patient from Reports Overview first.
        </div>
      ) : null}

      {validPatientId ? (
        <>
          <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
            <h2 className="text-base font-semibold text-white">Patient Detailed Health History</h2>
            <div className="mt-2 text-sm text-violet-200">
              {patient ? `${patient.patient_name || "Patient"} (${patient.patient_email || "no-email"})` : "Loading patient profile..."}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
            <h3 className="text-base font-semibold text-white">7-day averages</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {averages.length ? (
                averages.map((avg) => (
                  <div key={avg.metric_name} className="rounded-xl border border-violet-300/15 bg-[#1a1335] p-3">
                    <div className="text-xs text-violet-300/80">{avg.metric_name}</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {avg.avg_value}
                      {avg.metric_unit ? ` ${avg.metric_unit}` : ""}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-violet-300/80">No 7-day averages yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
            <h3 className="text-base font-semibold text-white">7-day trends</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {trendSeries.map((metric, index) => (
                <MetricTrendChart key={metric.name} metric={metric} index={index} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
            <h3 className="text-base font-semibold text-white">All reports</h3>
            <p className="mt-1 text-sm text-violet-300/80">Click a row to view metric details.</p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-violet-300/80 border-b border-violet-300/20">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Metrics</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedReports.map((report) => {
                    const reportId = report.recordedAt;
                    const isExpanded = expandedReportId === reportId;
                    return (
                      <React.Fragment key={reportId}>
                        <tr
                          className="border-b border-violet-300/10 cursor-pointer hover:bg-violet-800/20"
                          onClick={() => setExpandedReportId((prev) => (prev === reportId ? "" : reportId))}
                        >
                          <td className="py-3 pr-3 text-violet-100">{new Date(report.recordedAt).toLocaleString()}</td>
                          <td className="py-3 pr-3">{report.metricCount}</td>
                          <td className="py-3 pr-3 text-violet-200">{isExpanded ? "Hide details" : "View details"}</td>
                        </tr>
                        {isExpanded ? (
                          <tr className="border-b border-violet-300/10">
                            <td className="py-3 pr-3" colSpan={3}>
                              <div className="rounded-xl border border-violet-300/20 bg-[#1a1335] p-3 space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {report.metrics.map((metric) => (
                                    <div key={`${reportId}-${metric.metricName}`} className="text-sm text-violet-100">
                                      {metric.metricName}: {metric.value}
                                      {metric.unit ? ` ${metric.unit}` : ""}
                                    </div>
                                  ))}
                                </div>
                                {report.note ? <div className="text-xs text-violet-200/85">Note: {report.note}</div> : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}

                  {!loading && !groupedReports.length ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-violet-300/80">No reports found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="text-violet-300/85">
                Page {pagination.page} / {pagination.pages} ({pagination.total} reports)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => loadDetail(Math.max(1, pagination.page - 1))}
                  disabled={loading || pagination.page <= 1}
                  className="rounded-xl px-3 py-2 border border-violet-300/20 bg-violet-900/35 hover:bg-violet-900/50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => loadDetail(Math.min(pagination.pages, pagination.page + 1))}
                  disabled={loading || pagination.page >= pagination.pages}
                  className="rounded-xl px-3 py-2 border border-violet-300/20 bg-violet-900/35 hover:bg-violet-900/50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Write Medical Advice</h3>
              <form className="mt-3 space-y-3" onSubmit={submitAdvice}>
                <div>
                  <label className="block text-xs text-violet-300/85 mb-1" htmlFor="advice-content">
                    Advice Content
                  </label>
                  <textarea
                    id="advice-content"
                    value={adviceContent}
                    onChange={(e) => setAdviceContent(e.target.value)}
                    rows={4}
                    maxLength={3000}
                    placeholder="Write your advice for this patient..."
                    className="w-full rounded-xl border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-sm text-violet-100 placeholder:text-violet-300/45 outline-none focus:border-violet-300/40"
                  />
                </div>

                <div>
                  <label className="block text-xs text-violet-300/85 mb-1" htmlFor="advice-urgency">
                    Urgency
                  </label>
                  <select
                    id="advice-urgency"
                    value={adviceUrgency}
                    onChange={(e) => setAdviceUrgency(e.target.value)}
                    className="rounded-xl border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-sm text-violet-100 outline-none focus:border-violet-300/40"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="normal">Normal</option>
                    <option value="low">Not Urgent</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submittingAdvice || !adviceContent.trim()}
                    className="rounded-xl bg-violet-500 hover:bg-violet-400 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {submittingAdvice ? "Submitting..." : "Submit advice"}
                  </button>
                  {adviceMessage ? (
                    <span className={`text-xs ${adviceMessageType === "error" ? "text-rose-300" : "text-emerald-300"}`}>{adviceMessage}</span>
                  ) : null}
                </div>
              </form>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Recent Advice for This Patient</h3>
                <button
                  type="button"
                  onClick={() => loadAdviceHistory(advicePagination.page)}
                  disabled={adviceLoading}
                  className="rounded-lg border border-violet-300/25 bg-violet-900/35 hover:bg-violet-900/50 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-left text-violet-300/80 border-b border-violet-300/20">
                      <th className="py-2 pr-3 font-medium">Created</th>
                      <th className="py-2 pr-3 font-medium">Urgency</th>
                      <th className="py-2 pr-3 font-medium">Advice</th>
                      <th className="py-2 pr-3 font-medium text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adviceHistory.map((advice) => (
                      <tr key={advice.AdviceID} className="border-b border-violet-300/10 align-top">
                        <td className="py-3 pr-3 text-violet-100 whitespace-nowrap">{new Date(advice.created_at).toLocaleString()}</td>
                        <td className="py-3 pr-3 text-violet-200 whitespace-nowrap">
                          {advice.urgency === "urgent" ? "Urgent" : advice.urgency === "low" ? "Not Urgent" : "Normal"}
                        </td>
                        <td className="py-3 pr-3 text-violet-100 whitespace-pre-wrap">{advice.content}</td>
                        <td className="py-3 pr-3 text-right whitespace-nowrap">
                          {advice.is_acknowledged ? (
                            <span className="text-emerald-300 text-xs">Received</span>
                          ) : (
                            <span className="text-amber-300 text-xs">Pending receipt</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {!adviceLoading && !adviceHistory.length ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-violet-300/80">No advice records yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="text-violet-300/85">
                  Page {advicePagination.page} / {advicePagination.pages} ({advicePagination.total} advices)
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => loadAdviceHistory(Math.max(1, advicePagination.page - 1))}
                    disabled={adviceLoading || advicePagination.page <= 1}
                    className="rounded-xl px-3 py-2 border border-violet-300/20 bg-violet-900/35 hover:bg-violet-900/50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => loadAdviceHistory(Math.min(advicePagination.pages, advicePagination.page + 1))}
                    disabled={adviceLoading || advicePagination.page >= advicePagination.pages}
                    className="rounded-xl px-3 py-2 border border-violet-300/20 bg-violet-900/35 hover:bg-violet-900/50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              {adviceLoading ? <div className="mt-2 text-xs text-violet-300/80">Loading advice history...</div> : null}
            </div>
          </div>

          {loading ? <div className="text-sm text-violet-300/80">Loading patient detail...</div> : null}
          {error ? <div className="text-sm text-rose-300">{error}</div> : null}
        </>
      ) : null}
    </div>
  );
}
