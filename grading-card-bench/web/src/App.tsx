import { RigControlPage } from "./features/rig/RigControlPage";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Grading Card Bench</h1>
        <span className="tagline">Capture Bench &amp; Rig Control</span>
      </header>
      <main>
        <RigControlPage />
      </main>
    </div>
  );
}
