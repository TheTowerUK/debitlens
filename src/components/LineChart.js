// src/components/LineChart.js
import React from 'react';
import { View } from 'react-native';
import { Svg, Polyline, Line, Text } from 'react-native-svg';

export default function LineChart({ data = [], height = 200, padding = 24 }) {
  const [width, setWidth] = React.useState(0);

  return (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={{ height, borderWidth: 1, borderRadius: 12 }}
    >
      {width > 0 && data.length > 0 ? (
        <Svg width={width} height={height}>
          {/* Axes */}
          <Line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#999" strokeWidth="1" />
          <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#999" strokeWidth="1" />

          {/* Compute points */}
          {(() => {
            const values = data.map(d => Number(d.spend || 0));
            const maxY = Math.max(...values, 1);
            const minY = 0;
            const innerW = width - padding * 2;
            const innerH = height - padding * 2;
            const pts = data.map((d, i) => {
              const x = padding + (i / Math.max(1, data.length - 1)) * innerW;
              const yRatio = (Number(d.spend) - minY) / (maxY - minY || 1);
              const y = padding + innerH - yRatio * innerH;
              return `${x},${y}`;
            }).join(' ');

            return (
              <>
                {/* Y labels */}
                <Text x={padding - 6} y={padding + 6} fontSize="10" textAnchor="end">
                  {Math.max(...values, 0).toFixed(0)}
                </Text>
                <Text x={padding - 6} y={height - padding} fontSize="10" textAnchor="end">0</Text>
                {/* Line */}
                <Polyline points={pts} fill="none" stroke="#4F46E5" strokeWidth="2" />
              </>
            );
          })()}
        </Svg>
      ) : null}
    </View>
  );
}
