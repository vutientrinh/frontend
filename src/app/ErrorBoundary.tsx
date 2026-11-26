import { Component, type ReactNode } from "react";
import { Illustration } from "../components/brand/Illustration";
import { Page } from "../components/layout/Page";
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
        <main className="py-8">
          <Page width="narrow" className="text-center">
            <Illustration name="error-generic" size="lg" />
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="my-4">Reload the page to try again.</p>
            <button
              className="text-primary underline"
              onClick={() => location.reload()}
            >
              Reload
            </button>
          </Page>
        </main>
      );
    return this.props.children;
  }
}
