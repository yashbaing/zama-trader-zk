"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { CandleData } from "@/types";

/**
 * TradingView Lightweight Charts Wrapper
 *
 * Renders candlestick + volume charts using TradingView's
 * lightweight-charts library. Price data is PUBLIC (from CoinGecko
 * or similar). User-specific data (PnL, position size, entry prices)
 * is decrypted CLIENT-SIDE and overlaid as annotations.
 *
 * PRIVACY: The chart itself shows public market data.
 * The user's entry/exit markers are computed from decrypted
 * vault balances and never sent to any server.
 */

interface ChartProps {
  symbol: string;
  candles: CandleData[];
  height?: number;
  /** Decrypted entry price for position overlay (optional) */
  entryPrice?: number;
  /** Whether dark mode is active */
  darkMode?: boolean;
}

// Color scheme matching the ZKTrader design system
const CHART_COLORS = {
  background: "transparent",
  textColor: "#8898b5",
  gridColor: "rgba(26, 34, 54, 0.3)",
  crosshairColor: "rgba(0, 229, 255, 0.3)",
  upColor: "#00e676",
  downColor: "#ff5252",
  upWickColor: "#00e67680",
  downWickColor: "#ff525280",
  volumeUp: "rgba(0, 230, 118, 0.15)",
  volumeDown: "rgba(255, 82, 82, 0.15)",
  entryLine: "#00e5ff",
};

export default function TradingChart({
  symbol,
  candles,
  height = 340,
  entryPrice,
  darkMode = true,
}: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    let chart: any;

    async function initChart() {
      try {
        // Dynamic import to avoid SSR issues
        const { createChart, CrosshairMode } = await import(
          "lightweight-charts"
        );

        if (!chartContainerRef.current) return;

        chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height,
          layout: {
            background: { color: CHART_COLORS.background },
            textColor: CHART_COLORS.textColor,
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 11,
          },
          grid: {
            vertLines: { color: CHART_COLORS.gridColor },
            horzLines: { color: CHART_COLORS.gridColor },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: CHART_COLORS.crosshairColor,
              width: 1,
              style: 2, // Dashed
              labelVisible: true,
              labelBackgroundColor: "#121824",
            },
            horzLine: {
              color: CHART_COLORS.crosshairColor,
              width: 1,
              style: 2,
              labelVisible: true,
              labelBackgroundColor: "#121824",
            },
          },
          rightPriceScale: {
            borderColor: CHART_COLORS.gridColor,
            scaleMargins: { top: 0.1, bottom: 0.25 },
          },
          timeScale: {
            borderColor: CHART_COLORS.gridColor,
            timeVisible: true,
            secondsVisible: false,
          },
          handleScale: { mouseWheel: true, pinch: true },
          handleScroll: { mouseWheel: true, pressedMouseMove: true },
        });

        // Candlestick series
        const candleSeries = chart.addCandlestickSeries({
          upColor: CHART_COLORS.upColor,
          downColor: CHART_COLORS.downColor,
          borderUpColor: CHART_COLORS.upColor,
          borderDownColor: CHART_COLORS.downColor,
          wickUpColor: CHART_COLORS.upWickColor,
          wickDownColor: CHART_COLORS.downWickColor,
        });

        // Volume series (overlaid at bottom)
        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
        });

        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
          drawTicks: false,
        });

        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        chartRef.current = chart;

        // Set data
        if (candles.length > 0) {
          const chartCandles = candles.map((c, i) => ({
            time: Math.floor(c.time / 1000) as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));

          const volumeData = candles.map((c, i) => ({
            time: Math.floor(c.time / 1000) as any,
            value: c.volume || Math.random() * 1000,
            color:
              c.close >= c.open
                ? CHART_COLORS.volumeUp
                : CHART_COLORS.volumeDown,
          }));

          candleSeries.setData(chartCandles);
          volumeSeries.setData(volumeData);

          // Add entry price line if provided (from decrypted vault data)
          if (entryPrice) {
            candleSeries.createPriceLine({
              price: entryPrice,
              color: CHART_COLORS.entryLine,
              lineWidth: 1,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: "Entry (decrypted)",
            });
          }

          chart.timeScale().fitContent();
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Chart initialization failed:", error);
        setIsLoading(false);
      }
    }

    initChart();

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (chartRef.current && entries[0]) {
        chartRef.current.applyOptions({
          width: entries[0].contentRect.width,
        });
      }
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (chart) chart.remove();
    };
  }, [height]); // Only re-create on height change

  // Update data when candles change
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    const chartCandles = candles.map((c) => ({
      time: Math.floor(c.time / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = candles.map((c) => ({
      time: Math.floor(c.time / 1000) as any,
      value: c.volume || Math.random() * 1000,
      color:
        c.close >= c.open
          ? CHART_COLORS.volumeUp
          : CHART_COLORS.volumeDown,
    }));

    candleSeriesRef.current.setData(chartCandles);
    volumeSeriesRef.current.setData(volumeData);
  }, [candles]);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 24,
                height: 24,
                border: "2px solid rgba(0,229,255,0.2)",
                borderTop: "2px solid #00e5ff",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 8px",
              }}
            />
            <span
              style={{ fontSize: 11, color: "#5a6a8a" }}
            >
              Loading chart...
            </span>
          </div>
        </div>
      )}
      <div
        ref={chartContainerRef}
        style={{ width: "100%", height }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

/**
 * Generate demo candle data for a given base price.
 * Used when real market data isn't available.
 */
export function generateDemoCandles(
  basePrice: number,
  count = 100,
  intervalMs = 3600000 // 1 hour
): CandleData[] {
  const candles: CandleData[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const volatility = basePrice * 0.008;
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.3;
    const low = Math.min(open, close) - Math.random() * volatility * 0.3;
    const volume = (Math.random() * 500 + 50) * (basePrice / 1000);

    candles.push({
      time: now - (count - i) * intervalMs,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return candles;
}
