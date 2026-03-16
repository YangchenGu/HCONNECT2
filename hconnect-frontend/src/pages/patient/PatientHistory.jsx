import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../../lib/api.js";

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
    return {
      ...metric,
      points: dayKeys.map((dayKey) => ({
        dateKey: dayKey,
        value: metricMap.has(dayKey) ? metricMap.get(dayKey).value : null,
      })),
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
  if (Math.abs(value) >= 10) return (Math.round(value * 10) / 10).toFixed(1);
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
  const average = hasData ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

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
        <div className="text-xs text-violet-300/80">Avg 7d: {formatAverage(average, metric.unit)}</div>
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

function normalizeReportGroups(records) {
  const groups = new Map();

  for (const row of records) {
    const key = String(row.recorded_at || "");
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        recordedAt: key,
        note: row.notes || "",
        metrics: [],
      });
    }

    const report = groups.get(key);
    report.metrics.push({
      metricName: row.metric_name || "Metric",
      value: row.value,
      unit: row.metric_unit || "",
    });

    if (!report.note && row.notes) {
      report.note = row.notes;
    }
  }

  return Array.from(groups.values())
    .map((report) => ({
      ...report,
      metrics: report.metrics.sort((a, b) => a.metricName.localeCompare(b.metricName)),
    }))
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
}

export default function PatientHistory() {
  const { getAccessTokenSilently } = useAuth0();
  const [records, setRecords] = useState([]);
  const [reportSlots, setReportSlots] = useState([]);
  const [reportRecords, setReportRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState("");
  const [expandedReportId, setExpandedReportId] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 7, total: 0, pages: 1 });

  const reports = useMemo(() => {
    const recordsByTime = new Map();
    for (const row of reportRecords) {
      const key = String(row.recorded_at || "");
      if (!recordsByTime.has(key)) recordsByTime.set(key, []);
      recordsByTime.get(key).push(row);
    }

    return reportSlots.map((slot) => {
      const key = String(slot.recorded_at || "");
      const rows = recordsByTime.get(key) || [];
      return {
        recordedAt: key,
        note: slot.notes || rows[0]?.notes || "",
        metrics: rows.map((row) => ({
          metricName: row.metric_name || "Metric",
          value: row.value,
          unit: row.metric_unit || "",
        })),
      };
    });
  }, [reportRecords, reportSlots]);
  const dayKeys = useMemo(() => recentDayKeys(7), []);
  const trendSeries = useMemo(() => buildTrendSeries(records, dayKeys), [records, dayKeys]);

  useEffect(() => {
    async function loadTrendReports() {
      setLoading(true);
      setError("");
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/patient/reports?limit=500"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Failed to load reports");
        setRecords(payload.records || []);
      } catch (err) {
        setError(err.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    }

    loadTrendReports();
  }, [getAccessTokenSilently]);

  useEffect(() => {
    async function loadPagedReports() {
      setLoadingReports(true);
      setError("");
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl(`/api/patient/reports/paged?limit=7&page=${reportPage}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Failed to load paged reports");
        setReportSlots(payload.reportSlots || []);
        setReportRecords(payload.reportRecords || []);
        setPagination(payload.pagination || { page: 1, limit: 7, total: 0, pages: 1 });
        setExpandedReportId("");
      } catch (err) {
        setError(err.message || "Failed to load paged reports");
      } finally {
        setLoadingReports(false);
      }
    }

    loadPagedReports();
  }, [getAccessTokenSilently, reportPage]);

  function toggleDetails(reportId) {
    setExpandedReportId((prev) => (prev === reportId ? "" : reportId));
  }

  return (
    <div className="p-6 text-violet-100">
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

      <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 mb-4">
        <h2 className="text-base font-semibold text-white">7-day metric trends</h2>
        <p className="mt-1 text-sm text-violet-300/80">Missing days are shown as gaps in each chart.</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {trendSeries.map((metric, index) => (
            <MetricTrendChart key={metric.name} metric={metric} index={index} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
        <h2 className="text-base font-semibold text-white">My health reports</h2>
        <p className="mt-1 text-sm text-violet-300/80">Each row is one submitted report. Click a row to view details.</p>

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
              {loading ? (
                <tr>
                  <td className="py-3 pr-3 text-violet-300/80" colSpan={3}>
                    Loading reports...
                  </td>
                </tr>
              ) : null}

              {loadingReports ? (
                <tr>
                  <td className="py-3 pr-3 text-violet-300/80" colSpan={3}>
                    Loading paged reports...
                  </td>
                </tr>
              ) : null}

              {!loading && error ? (
                <tr>
                  <td className="py-3 pr-3 text-rose-300" colSpan={3}>
                    {error}
                  </td>
                </tr>
              ) : null}

              {!loading && !error && !reports.length ? (
                <tr>
                  <td className="py-3 pr-3 text-violet-300/80" colSpan={3}>
                    No submitted reports yet.
                  </td>
                </tr>
              ) : null}

              {!loading && !loadingReports && !error
                ? reports.map((report) => {
                    const reportId = report.recordedAt;
                    const isExpanded = expandedReportId === reportId;
                    return (
                      <React.Fragment key={reportId}>
                        <tr
                          className="border-b border-violet-300/10 cursor-pointer hover:bg-violet-800/20"
                          onClick={() => toggleDetails(reportId)}
                        >
                          <td className="py-3 pr-3 text-violet-100">{new Date(report.recordedAt).toLocaleString()}</td>
                          <td className="py-3 pr-3">{report.metrics.length}</td>
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
                  })
                : null}
            </tbody>
          </table>
        </div>

        {!loading && !loadingReports && !error && reports.length ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-violet-300/85">
              Page {pagination.page} / {pagination.pages} ({pagination.total} reports)
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setExpandedReportId("");
                  setReportPage((prev) => Math.max(1, prev - 1));
                }}
                disabled={reportPage <= 1 || loadingReports}
                className="rounded-xl px-3 py-2 border border-violet-300/20 bg-violet-900/35 hover:bg-violet-900/50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpandedReportId("");
                  setReportPage((prev) => Math.min(pagination.pages, prev + 1));
                }}
                disabled={reportPage >= pagination.pages || loadingReports}
                className="rounded-xl px-3 py-2 border border-violet-300/20 bg-violet-900/35 hover:bg-violet-900/50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
