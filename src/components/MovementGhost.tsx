import { motion } from "framer-motion";
import { springTransition } from "./timelineShared";

interface Props {
  isBar: boolean;
  y: number;
  color: string;
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
}

/**
 * A faded marker at an item's original position, plus an arrow to where it stands
 * now — the only way a still PNG/PDF can convey the slip/pull-in the live scrubber
 * animates. Drawn as a plain line + filled triangle rather than an SVG <marker>
 * arrowhead: html2canvas's SVG support doesn't reliably render marker-end.
 */
export function MovementGhost({ isBar, y, color, oldStart, oldEnd, newStart, newEnd }: Props) {
  const oldAnchor = (oldStart + oldEnd) / 2;
  const newAnchor = (newStart + newEnd) / 2;
  const dir = newAnchor >= oldAnchor ? 1 : -1;
  const tipX = newAnchor - dir * 10;
  const arrowPoints = dir === 1 ? "0,0 -8,-4 -8,4" : "0,0 8,-4 8,4";

  return (
    <g opacity={0.65}>
      <motion.line
        x1={oldAnchor}
        y1={y}
        y2={y}
        animate={{ x2: tipX }}
        initial={{ x2: tipX }}
        transition={springTransition}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="3 3"
      />
      <motion.g animate={{ x: tipX, y }} initial={{ x: tipX, y }} transition={springTransition}>
        <polygon points={arrowPoints} fill={color} />
      </motion.g>
      {isBar ? (
        <rect
          x={oldStart}
          y={y - 4}
          width={Math.max(oldEnd - oldStart, 4)}
          height={8}
          rx={4}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
      ) : (
        <rect
          x={oldAnchor - 6}
          y={y - 6}
          width={12}
          height={12}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="2 2"
          transform={`rotate(45 ${oldAnchor} ${y})`}
        />
      )}
    </g>
  );
}
