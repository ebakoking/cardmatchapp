'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [newSignupsEnabled, setNewSignupsEnabled] = useState(true);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>

      <div className="space-y-6">
        <div className="rounded-lg bg-surface p-6">
          <h2 className="mb-4 text-xl font-semibold">App Configuration</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span>Maintenance Mode</span>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="h-5 w-5"
              />
            </label>
            <label className="flex items-center justify-between">
              <span>Enable New Signups</span>
              <input
                type="checkbox"
                checked={newSignupsEnabled}
                onChange={(e) => setNewSignupsEnabled(e.target.checked)}
                className="h-5 w-5"
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg bg-surface p-6">
          <h2 className="mb-4 text-xl font-semibold">Card Management</h2>
          <p className="text-textMuted">
            Card management interface will be implemented here.
          </p>
        </div>
      </div>
    </div>
  );
}
