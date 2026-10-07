import { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { letterNeedsBaseMark } from "@shared/dice";
import type { Cell } from "@shared/types";
import { colors } from "../theme";

type Flash = "success" | "fail" | null;

type Props = {
  grid: Cell[];
  path: number[];
  flash: Flash;
  disabled?: boolean;
  onPathChange: (path: number[]) => void;
  onSubmit: (path: number[]) => void;
};

const PAD = 0.04;
const GAP = 0.034;
const HIT = 0.38;

function dieCenter(index: number, size: number): { x: number; y: number } {
  const pad = size * PAD;
  const gap = size * GAP;
  const cell = (size - pad * 2 - gap * 3) / 4;
  const row = Math.floor(index / 4);
  const col = index % 4;
  return {
    x: pad + col * (cell + gap) + cell / 2,
    y: pad + row * (cell + gap) + cell / 2,
  };
}

function dieSize(board: number): number {
  const pad = board * PAD;
  const gap = board * GAP;
  return (board - pad * 2 - gap * 3) / 4;
}

function cellFromPoint(x: number, y: number, size: number): number | null {
  let best: { index: number; dist: number } | null = null;
  const radius = dieSize(size) * HIT;
  for (let i = 0; i < 16; i++) {
    const c = dieCenter(i, size);
    const dist = Math.hypot(x - c.x, y - c.y);
    if (dist <= radius && (!best || dist < best.dist)) {
      best = { index: i, dist };
    }
  }
  return best?.index ?? null;
}

export default function Board({
  grid,
  path,
  flash,
  disabled,
  onPathChange,
  onSubmit,
}: Props) {
  const [size, setSize] = useState(0);
  const drawing = useRef(false);
  const pathRef = useRef(path);
  const disabledRef = useRef(disabled);
  const onPathChangeRef = useRef(onPathChange);
  const onSubmitRef = useRef(onSubmit);
  pathRef.current = path;
  disabledRef.current = disabled;
  onPathChangeRef.current = onPathChange;
  onSubmitRef.current = onSubmit;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setSize(e.nativeEvent.layout.width);
  }, []);

  const setPath = (next: number[]) => {
    pathRef.current = next;
    onPathChangeRef.current(next);
  };

  const extend = (index: number) => {
    const current = pathRef.current;
    if (current[current.length - 1] === index) return;
    if (current.length >= 2 && current[current.length - 2] === index) {
      setPath(current.slice(0, -1));
      return;
    }
    if (current.includes(index)) return;
    if (current.length === 0) {
      setPath([index]);
      return;
    }
    const last = current[current.length - 1];
    const lr = Math.floor(last / 4);
    const lc = last % 4;
    const nr = Math.floor(index / 4);
    const nc = index % 4;
    if (Math.max(Math.abs(lr - nr), Math.abs(lc - nc)) === 1) {
      setPath([...current, index]);
    }
  };

  const localPoint = (e: GestureResponderEvent) => ({
    x: e.nativeEvent.locationX,
    y: e.nativeEvent.locationY,
  });

  const onStart = (e: GestureResponderEvent) => {
    if (disabledRef.current || size <= 0) return;
    const { x, y } = localPoint(e);
    const index = cellFromPoint(x, y, size);
    if (index === null) return;
    drawing.current = true;
    setPath([index]);
  };

  const onMove = (e: GestureResponderEvent) => {
    if (!drawing.current || disabledRef.current || size <= 0) return;
    const { x, y } = localPoint(e);
    const index = cellFromPoint(x, y, size);
    if (index === null) return;
    extend(index);
  };

  const finish = (submit: boolean) => {
    if (!drawing.current) return;
    drawing.current = false;
    const current = pathRef.current;
    if (submit && current.length) onSubmitRef.current(current);
  };

  const cell = size > 0 ? dieSize(size) : 0;
  const points = useMemo(
    () => (size > 0 ? path.map((i) => dieCenter(i, size)) : []),
    [path, size],
  );
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View
      style={styles.wrap}
      onLayout={onLayout}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => drawing.current}
      onResponderGrant={onStart}
      onResponderMove={onMove}
      onResponderRelease={() => finish(true)}
      onResponderTerminate={() => finish(false)}
    >
      <View style={[styles.board, flash === "fail" && styles.reject]} pointerEvents="none">
        {size > 0 &&
          grid.map((die, i) => {
            const center = dieCenter(i, size);
            const active = path.includes(i);
            const current = path[path.length - 1] === i;
            return (
              <View
                key={i}
                style={[
                  styles.die,
                  {
                    width: cell,
                    height: cell,
                    borderRadius: cell * 0.22,
                    left: center.x - cell / 2,
                    top: center.y - cell / 2,
                  },
                  active && styles.dieActive,
                  current && styles.dieCurrent,
                  flash === "success" && active && styles.dieSuccess,
                  flash === "fail" && active && styles.dieFail,
                ]}
              >
                <Text
                  style={[
                    styles.face,
                    { fontSize: die.letter === "QU" ? cell * 0.34 : cell * 0.42 },
                    letterNeedsBaseMark(die.display) && styles.marked,
                    { transform: [{ rotate: `${die.rotation}deg` }] },
                  ]}
                >
                  {die.display}
                </Text>
              </View>
            );
          })}
      </View>

      {size > 0 && points.length > 0 && (
        <Svg style={StyleSheet.absoluteFill as object} width={size} height={size} pointerEvents="none">
          {points.length > 1 && (
            <>
              <Polyline
                points={line}
                fill="none"
                stroke="rgba(15, 61, 56, 0.55)"
                strokeWidth={size * 0.054}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={line}
                fill="none"
                stroke={colors.goldSoft}
                strokeWidth={size * 0.026}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === points.length - 1 ? size * 0.036 : size * 0.024}
              fill={i === points.length - 1 ? colors.cream : colors.goldSoft}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    aspectRatio: 1,
    maxWidth: 420,
    alignSelf: "center",
  },
  board: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.felt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  reject: {
    borderColor: "rgba(255,93,74,0.55)",
  },
  die: {
    position: "absolute",
    backgroundColor: colors.ivory,
    alignItems: "center",
    justifyContent: "center",
  },
  dieActive: {
    backgroundColor: colors.goldSoft,
  },
  dieCurrent: {
    borderWidth: 2,
    borderColor: colors.cream,
  },
  dieSuccess: {
    backgroundColor: "#6fdb9a",
  },
  dieFail: {
    backgroundColor: "#ff8a7a",
  },
  face: {
    color: colors.ink,
    fontWeight: "800",
  },
  marked: {
    textDecorationLine: "underline",
  },
});
