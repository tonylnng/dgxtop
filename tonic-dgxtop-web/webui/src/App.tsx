import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Header } from "@/components/Header";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import { Overview } from "@/pages/Overview";
import { GpuDetail } from "@/pages/GpuDetail";
import { Processes } from "@/pages/Processes";

export function App() {
  const { snapshot, connected } = useLiveSnapshot();
  return (
    <BrowserRouter>
      <Header connected={connected} ts={snapshot?.timestamp} />
      {!snapshot ? (
        <div className="p-8 text-muted">Waiting for first snapshot…</div>
      ) : (
        <Routes>
          <Route path="/" element={<Overview snap={snapshot} />} />
          <Route path="/gpu/:id" element={<GpuDetail snap={snapshot} />} />
          <Route path="/processes" element={<Processes snap={snapshot} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
