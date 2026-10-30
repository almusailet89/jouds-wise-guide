import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { useLanguage } from '@/hooks/useLanguage';
import { GlassDonut } from './GlassDonut';
import { PALETTE } from './chartTheme';

interface AllocationData {
  name: string;
  value: number;
  color: string;
}

interface AllocationChartProps {
  data: AllocationData[];
  title?: string;
}

export const AllocationChart: React.FC<AllocationChartProps> = ({
  data,
  title = "Portfolio Allocation"
}) => {
  const { dir } = useLanguage();
  const slices = data.map((item, i) => ({ name: item.name, value: item.value, color: PALETTE[i % PALETTE.length] }));
  const total = slices.reduce((s, d) => s + d.value, 0);
  const largest = slices.reduce<typeof slices[number] | null>((top, s) => (!top || s.value > top.value ? s : top), null);

  return (
    <Card className="luxury-card" dir={dir}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-arabic text-base">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-jood-teal-700 to-jood-teal-500 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {slices.length > 0 && largest ? (
          <GlassDonut
            data={slices}
            dir={dir}
            centerLabel={largest.name}
            centerValue={`${Math.round((largest.value / (total || 1)) * 100)}%`}
            formatValue={(_, share) => (
              <span className="font-mono font-bold text-foreground">{(share * 100).toFixed(1)}%</span>
            )}
          />
        ) : (
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground font-medium">No portfolio data</p>
              <p className="text-sm text-muted-foreground">Add holdings to see allocation</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
