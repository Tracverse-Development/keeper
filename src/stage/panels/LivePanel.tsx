/**
 * A live dashboard of this computer: processor and memory gauges, network speed in and out with a
 * short history line, disk space, and the busiest apps. Reads `system_live` every 1.5 s while it
 * is on screen (and stops when it isn't); the readings stay on this computer.
 */
import { useEffect, useRef, useState } from 'react';

import { core, type SystemLive } from '../../kernel/ipc';
import type { PanelProps } from './panel-props.ts';

const EVERY_MS = 1500;
const HISTORY = 40;

const speed = (kbps: number) => (kbps >= 1024 ? `${(kbps / 1024).toFixed(1)} MB/s` : `${Math.round(kbps)} KB/s`);

function Gauge({ label, value, detail }: { label: string; value: number; detail: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="live-gauge">
      <svg viewBox="0 0 120 70" aria-hidden="true">
        <path className="live-track" d="M10 62a50 50 0 0 1 100 0" />
        <path className="live-fill" d="M10 62a50 50 0 0 1 100 0" pathLength={100} strokeDasharray={`${v} 100`} />
      </svg>
      <span className="live-num">{Math.round(v)}%</span>
      <span className="live-label">{label}</span>
      <span className="muted small">{detail}</span>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => `${(i / Math.max(1, HISTORY - 1)) * 200},${40 - (v / max) * 36}`).join(' ');
  return (
    <svg className="live-spark" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

export function LivePanel({ panel }: PanelProps<'live'>) {
  const [now, setNow] = useState<SystemLive | null>(null);
  const down = useRef<number[]>([]);
  const show = (m: string) => panel.metrics.length === 0 || panel.metrics.includes(m as never);

  useEffect(() => {
    let alive = true;
    const read = () =>
      core
        .systemLive()
        .then((r) => {
          if (!alive) return;
          down.current = [...down.current, r.netDownKbps].slice(-HISTORY);
          setNow(r);
        })
        .catch(() => undefined);
    void read();
    const timer = window.setInterval(read, EVERY_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!now) return <p className="muted">Reading your computer…</p>;
  return (
    <div className="live">
      <div className="live-gauges">
        {show('cpu') && <Gauge label="Processor" value={now.cpu} detail="all cores" />}
        {show('memory') && <Gauge label="Memory" value={now.memory} detail={`${now.memoryUsedGb.toFixed(1)} of ${now.memoryTotalGb.toFixed(0)} GB`} />}
        {show('disk') && <Gauge label="Disk" value={now.diskTotalGb ? (now.diskUsedGb / now.diskTotalGb) * 100 : 0} detail={`${(now.diskTotalGb - now.diskUsedGb).toFixed(0)} GB free`} />}
      </div>
      {show('network') && (
        <div className="live-net">
          <span>↓ {speed(now.netDownKbps)}</span>
          <span>↑ {speed(now.netUpKbps)}</span>
          <Spark values={down.current} />
        </div>
      )}
      {show('apps') && now.top.length > 0 && (
        <ol className="live-apps">
          {now.top.map(([name, cpu]) => (
            <li key={name}>
              <span>{name}</span>
              <span className="live-bar"><span style={{ width: `${Math.min(100, cpu)}%` }} /></span>
              <span className="muted small">{Math.round(cpu)}%</span>
            </li>
          ))}
        </ol>
      )}
      <span className="live-tag muted small"><span className="live-pulse" aria-hidden="true" /> live, updating</span>
    </div>
  );
}
