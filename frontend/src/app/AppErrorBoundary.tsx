import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
    children: ReactNode;
}

interface AppErrorBoundaryState {
    hasError: boolean;
    message?: string;
}

export class AppErrorBoundary extends Component<
    AppErrorBoundaryProps,
    AppErrorBoundaryState
> {
    state: AppErrorBoundaryState = {
        hasError: false,
        message: undefined,
    };

    static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
        return {
            hasError: true,
            message: error?.message || "Unknown rendering error",
        };
    }

    componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
        // Keep fallback visible; detailed stack is available in browser devtools.
        console.error(_error, _errorInfo);
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="app-shell">
                    <header className="app-header">
                        <div className="app-title">
                            <h1>CinemaStream Analytics</h1>
                            <span className="subtitle">
                                UI recovered from a rendering error
                            </span>
                        </div>
                    </header>
                    <main className="main-content">
                        <section className="data-panel">
                            <div className="empty-state">
                                <div className="icon">⚠️</div>
                                Something went wrong while rendering the
                                dashboard.
                                {this.state.message ?
                                    ` Error: ${this.state.message}`
                                :   ""}
                            </div>
                        </section>
                    </main>
                </div>
            );
        }

        return this.props.children;
    }
}
