'use client';

import { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Search, Download } from 'lucide-react';

interface AgentLog {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: any;
  timestamp: number;
}

const LOG_LEVELS = {
  debug: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'DEBUG' },
  info: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'INFO' },
  warn: { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'WARN' },
  error: { color: 'text-red-600', bg: 'bg-red-100', label: 'ERROR' },
};

const MAX_LOGS = 500; // Maximum logs to keep in memory

export function AgentLogs({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string[]>(['info', 'warn', 'error']);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleWebSocketMessage = (message: any) => {
    if (message.type === 'agent_log') {
      const newLog: AgentLog = {
        id: `${message.timestamp}-${Math.random()}`,
        level: message.data.level,
        message: message.data.message,
        metadata: message.data.metadata,
        timestamp: message.data.timestamp,
      };

      setLogs((prev) => {
        const updated = [...prev, newLog];
        // Keep only the last MAX_LOGS entries
        return updated.slice(-MAX_LOGS);
      });
    }
  };

  const { status: wsStatus } = useWebSocket({
    userId,
    onMessage: handleWebSocketMessage,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const logText = filteredLogs
      .map((log) => {
        const date = new Date(log.timestamp).toISOString();
        return `[${date}] [${log.level.toUpperCase()}] ${log.message}`;
      })
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleLevelFilter = (level: string) => {
    setLevelFilter((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter.includes(log.level);
    const matchesSearch = filter
      ? log.message.toLowerCase().includes(filter.toLowerCase())
      : true;
    return matchesLevel && matchesSearch;
  });

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Agent Logs</CardTitle>
            <CardDescription>
              Real-time logs from your backup agent
              {wsStatus !== 'connected' && (
                <span className="ml-2 text-yellow-600">(WebSocket: {wsStatus})</span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
              disabled={filteredLogs.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-1">
            {Object.entries(LOG_LEVELS).map(([level, config]) => (
              <Button
                key={level}
                variant={levelFilter.includes(level) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleLevelFilter(level)}
                className={levelFilter.includes(level) ? config.bg : ''}
              >
                {config.label}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
        </div>
      </CardHeader>

      <CardContent>
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm h-[600px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              {logs.length === 0 ? 'No logs yet. Waiting for agent activity...' : 'No logs match the current filters.'}
            </div>
          ) : (
            <>
              {filteredLogs.map((log) => {
                const levelConfig = LOG_LEVELS[log.level];
                return (
                  <div key={log.id} className="mb-1 hover:bg-gray-800 p-1 rounded">
                    <span className="text-gray-500">{formatTime(log.timestamp)}</span>
                    <span
                      className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${levelConfig.bg} ${levelConfig.color}`}
                    >
                      {levelConfig.label}
                    </span>
                    <span className="ml-2">{log.message}</span>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="ml-16 text-gray-400 text-xs mt-1">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </>
          )}
        </div>

        <div className="mt-2 text-xs text-muted-foreground flex justify-between">
          <span>
            Showing {filteredLogs.length} of {logs.length} logs
            {logs.length >= MAX_LOGS && ` (max ${MAX_LOGS})`}
          </span>
          {wsStatus === 'connected' && (
            <span className="text-green-600">● Live</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
