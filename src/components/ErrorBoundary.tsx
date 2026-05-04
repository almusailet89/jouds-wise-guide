import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Tab-level error boundary — isolates crashes so one broken tab
 * doesn't take down the entire Dashboard.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center" dir="rtl">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <p className="font-bold font-arabic text-sm text-foreground">
            {this.props.fallbackLabel ?? 'حدث خطأ غير متوقع'}
          </p>
          <p className="text-xs text-muted-foreground font-arabic mt-1">
            جرّب تحديث الصفحة أو تواصل معنا إذا استمر المشكلة
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={this.reset}
          className="gap-2 font-arabic text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          حاول مرة أخرى
        </Button>
      </div>
    );
  }
}
