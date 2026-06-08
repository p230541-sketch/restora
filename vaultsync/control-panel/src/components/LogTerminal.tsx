import React, { useEffect, useRef, useState } from "react";
import { colors } from "../styles/theme";

interface LogLine {
  ts: string;
  level: "INFO" | "WARN" | "ERROR";
  msg: string;
}

interface Props {
  nodeId: string;
}

export function LogTerminal({ nodeId }: Props) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Same-origin EventSource sends the httpOnly auth cookie automatically.
    const es = new EventSource(`/api/nodes/${nodeId}/logs`);
    es.onmessage = (e) => {
      try {
        const line: LogLine = JSON.parse(e.data);
        setLines((prev) => [...prev.slice(-199), line]);
      } catch {
        setLines((prev) => [
          ...prev.slice(-199),
          { ts: new Date().toISOString(), level: "INFO", msg: e.data },
        ]);
      }
    };
    return () => es.close();
  }, [nodeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  function levelColor(level: string): string {
    if (level === "WARN") return colors.orange;
    if (level === "ERROR") return colors.red;
    return colors.green;
  }

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{
        background: "#1c2128", padding: "8px 16px", display: "flex",
        alignItems: "center", gap: 8, borderBottom: `1px solid ${colors.border}`,
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#f85149", "#e3b341", "#3fb950"].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 8, fontFamily: "monospace" }}>
          backup-execution.log — 88×24
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: colors.textMuted }}>UTF-8  bash</span>
      </div>
      <div style={{
        fontFamily: "monospace", fontSize: 12, lineHeight: 1.6,
        background: "#010409", color: colors.green,
        padding: "12px 16px", height: 260, overflowY: "auto",
      }}>
        {lines.length === 0 ? (
          <span style={{ color: colors.textMuted }}>Waiting for log stream...</span>
        ) : (
          lines.map((l, i) => (
            <div key={i}>
              <span style={{ color: colors.textMuted }}>[{l.ts.replace("T", " ").slice(0, 19)}]</span>{" "}
              <span style={{ color: levelColor(l.level) }}>{l.level}</span>{" "}
              <span style={{ color: colors.textPrimary }}>{l.msg}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
