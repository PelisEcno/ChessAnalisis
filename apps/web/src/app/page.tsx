// Import de prueba: confirma que Next puede resolver y transpilar
// @peon-libre/core (TypeScript sin compilar) desde el workspace.
import "@peon-libre/core";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 p-8 text-center text-neutral-100">
      <h1 className="text-3xl font-semibold">Peón Libre</h1>
      <p className="max-w-md text-neutral-400">
        Monorepo en construcción. Esta pantalla es un placeholder de la fase 0
        (bootstrap): todavía no hay lógica de análisis conectada.
      </p>
    </div>
  );
}
