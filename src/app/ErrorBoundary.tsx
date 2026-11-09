import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <main className="p-8">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="my-4">Reload the page to try again.</p>
          <button
            className="text-primary underline"
            onClick={() => location.reload()}
          >
            Reload
          </button>
        </main>
      );
    return this.props.children;
  }
}
