/**
 * A live dashboard of this computer: processor and memory gauges, the network (what the traffic
 * means in words, speed in and out each with its own history line, the peak of the last minute,
 * this computer's address and the totals since it started), disk space, and the busiest apps. Reads `system_live` every 1.5 s while it
 * is on screen (and stops when it isn't); the readings stay on this computer.
 */
import { useEffect, useRef, useState } from 'react';

import { core, type SystemLive } from '../../kernel/ipc';
import { amountWords, netReading, peak, speedWords } from '../live-net';
import type { PanelProps } from './panel-props.ts';

const EVERY_MS = 1500;
const HISTORY = 40;

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

/** The network: what the traffic means, then each direction with its history, then the facts. */
function Network({ now, down, up }: { now: SystemLive; down: number[]; up: number[] }) {
  const reading = netReading(now.netDownKbps, now.netUpKbps, now.netAddress);
  return (
    <div className={`live-net is-${reading.level}`}>
      <p className="live-net-reading">
        <strong>{reading.title}.</strong> <span className="muted">{reading.meaning}</span>
      </p>
      {reading.level !== 'offline' && (
        <>
          <div className="live-net-flows">
            <div className="live-flow">
              <span className="live-label">Coming in</span>
              <span className="live-flow-num">{speedWords(now.netDownKbps)}</span>
              <Spark values={down} />
              <span className="muted small">Peak in the last minute: {speedWords(peak(down))}</span>
            </div>
            <div className="live-flow">
              <span className="live-label">Going out</span>
              <span className="live-flow-num">{speedWords(now.netUpKbps)}</span>
              <Spark values={up} />
              <span className="muted small">Peak in the last minute: {speedWords(peak(up))}</span>
            </div>
          </div>
          <dl className="live-net-facts">
            <div>
              <dt>This Mac's address</dt>
              <dd className="selectable">{now.netAddress}</dd>
            </div>
            <div>
              <dt>Since it started</dt>
              <dd>
                {amountWords(now.netTotalDownGb)} in, {amountWords(now.netTotalUpGb)} out
              </dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
}

export function LivePanel({ panel }: PanelProps<'live'>) {
  const [now, setNow] = useState<SystemLive | null>(null);
  const down = useRef<number[]>([]);
  const up = useRef<number[]>([]);
  const show = (m: string) => panel.metrics.length === 0 || panel.metrics.includes(m as never);

  useEffect(() => {
    let alive = true;
    const read = () =>
      core
        .systemLive()
        .then((r) => {
          if (!alive) return;
          down.current = [...down.current, r.netDownKbps].slice(-HISTORY);
          up.current = [...up.current, r.netUpKbps].slice(-HISTORY);
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
      {show('network') && <Network now={now} down={down.current} up={up.current} />}
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
