// src/components/LineChart.js
import React from 'react';
import { View } from 'react-native';
import { Svg, Polyline, Line, Text } from 'react-native-svg';

export default function LineChart({ data = [], height = 200, padding = 24 }) {
  // data = [{ x: "2025-08", spend: 123.45 }, ...]
  const width = 320; // simple fixed width; adjust if you like
  if (!data.length) return <View style={{ height, borderWidth: 1, borderRadius: 12 }} />;

  const values = data.map(d => Number(d.spend || 0));
  const maxY = Math.max(...values, 1);
  const minY = 0;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(1, data.length - 1)) * innerW;
    const yRatio = (Number(d.spend) - minY) / (maxY - minY || 1);
    const y = padding + innerH - yRatio * innerH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <View style={{ height, borderWidth: 1, borderRadius: 12 }}>
      <Svg width={width} height={height}>
        {/* Axes */}
        <Line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#999" strokeWidth="1" />
        <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#999" strokeWidth="1" />
        {/* Y labels (min/max) */}
        <Text x={padding - 6} y={padding + 6} fontSize="10" textAnchor="end">{maxY.toFixed(0)}</Text>
        <Text x={padding - 6} y={height - padding} fontSize="10" textAnchor="end">{minY.toFixed(0)}</Text>
        {/* Line */}
        <Polyline points={points} fill="none" stroke="#4F46E5" strokeWidth="2" />
      </Svg>
    </View>
  );
}
