'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Report {
  id: string;
  reporter: { nickname: string };
  reported: { nickname: string };
  category: string;
  description: string;
  screenshot?: string;
  status: string;
  createdAt: string;
  sessionId?: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/api/admin/reports');
      setReports(res.data.data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post(`/api/admin/reports/${id}/action`, { action });
      fetchReports();
      setSelectedReport(null);
    } catch (error) {
      console.error('Failed to process action:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Reports</h1>

      <div className="overflow-x-auto rounded-lg bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-background">
              <th className="px-4 py-3 text-left">Reporter</th>
              <th className="px-4 py-3 text-left">Reported</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr
                key={report.id}
                className="cursor-pointer border-b border-background hover:bg-background"
                onClick={() => setSelectedReport(report)}
              >
                <td className="px-4 py-3">{report.reporter.nickname}</td>
                <td className="px-4 py-3">{report.reported.nickname}</td>
                <td className="px-4 py-3">{report.category}</td>
                <td className="px-4 py-3 text-sm">
                  {new Date(report.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">{report.status}</td>
                <td className="px-4 py-3">
                  <button className="rounded bg-primary px-2 py-1 text-xs hover:opacity-90">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-surface p-6">
            <h2 className="mb-4 text-xl font-bold">Report Details</h2>
            <div className="space-y-4">
              <div>
                <strong>Reporter:</strong> {selectedReport.reporter.nickname}
              </div>
              <div>
                <strong>Reported:</strong> {selectedReport.reported.nickname}
              </div>
              <div>
                <strong>Category:</strong> {selectedReport.category}
              </div>
              <div>
                <strong>Description:</strong> {selectedReport.description}
              </div>
              {selectedReport.screenshot && (
                <div>
                  <strong>Screenshot:</strong>
                  <img
                    src={selectedReport.screenshot}
                    alt="Screenshot"
                    className="mt-2 rounded"
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => handleAction(selectedReport.id, 'unshadowban')}
                className="rounded bg-success px-4 py-2 hover:opacity-90"
              >
                Unshadowban
              </button>
              <button
                onClick={() => handleAction(selectedReport.id, 'ban')}
                className="rounded bg-danger px-4 py-2 hover:opacity-90"
              >
                Ban Permanently
              </button>
              <button
                onClick={() => handleAction(selectedReport.id, 'reviewed')}
                className="rounded bg-primary px-4 py-2 hover:opacity-90"
              >
                Mark Reviewed
              </button>
              <button
                onClick={() => setSelectedReport(null)}
                className="rounded bg-textMuted px-4 py-2 hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
