import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Full-screen radial gradient background emanating from the top-right corner,
 * using the same dark-navy colour stops as the previous linear gradient.
 */
export function RadialBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
      <Defs>
        <RadialGradient
          id="bg"
          cx={width}
          cy={0}
          rx={width * 1.4}
          ry={height * 1.1}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%"   stopColor="#171864" stopOpacity="1" />
          <Stop offset="55%"  stopColor="#10103B" stopOpacity="1" />
          <Stop offset="100%" stopColor="#090921" stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#bg)" />
    </Svg>
  );
}
