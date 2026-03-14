import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../../lib/api.js";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedReportId, setExpandedReportId] = useState("");

  const reports = useMemo(() => normalizeReportGroups(records), [records]);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      setError("");
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/patient/reports?limit=300"), {
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

    loadReports();
  }, [getAccessTokenSilently]);

  function toggleDetails(reportId) {
    setExpandedReportId((prev) => (prev === reportId ? "" : reportId));
  }

  return (
    <div className="p-6 text-violet-100">
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

              {!loading && !error
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
      </div>
    </div>
  );
}
