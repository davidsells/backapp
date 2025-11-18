'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Alert {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
  config: {
    name: string;
  };
}

export function AlertBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch unacknowledged alerts
  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts?unacknowledged=true');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAlerts(data.alerts);
        }
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Poll for new alerts every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
      });

      if (res.ok) {
        // Remove alert from list
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const acknowledgeAll = async () => {
    try {
      const res = await fetch('/api/alerts/acknowledge-all', {
        method: 'POST',
      });

      if (res.ok) {
        setAlerts([]);
      }
    } catch (error) {
      console.error('Failed to acknowledge all alerts:', error);
    }
  };

  if (loading || alerts.length === 0) {
    return null;
  }

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'failure':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'failure':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  return (
    <div className="mb-6 space-y-2">
      {/* Header with dismiss all button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {alerts.length} Active {alerts.length === 1 ? 'Alert' : 'Alerts'}
        </h3>
        {alerts.length > 1 && (
          <Button variant="ghost" size="sm" onClick={acknowledgeAll}>
            Dismiss All
          </Button>
        )}
      </div>

      {/* Alert cards */}
      {alerts.map((alert) => (
        <Card
          key={alert.id}
          className={`p-4 border ${getAlertColor(alert.type)}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <span className="text-xl">{getAlertIcon(alert.type)}</span>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{alert.message}</p>
                <p className="text-xs opacity-75">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => acknowledgeAlert(alert.id)}
              className="hover:bg-white/50"
            >
              Dismiss
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
