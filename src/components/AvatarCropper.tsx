import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import {
  clampPan,
  drawCroppedAvatar,
  exportAvatarDataUrl,
  type CropFrame,
} from "../lib/crop-avatar";

const VIEW = 260;

type Props = {
  image: HTMLImageElement;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};

export default function AvatarCropper({ image, busy, onCancel, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [frame, setFrame] = useState<CropFrame>({ zoom: 1, panX: 0, panY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = VIEW;
    canvas.height = VIEW;
    drawCroppedAvatar(ctx, image, VIEW, frame);
  }, [image, frame]);

  const move = (next: CropFrame) => setFrame(clampPan(image, VIEW, next));

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, panX: frame.panX, panY: frame.panY };
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    move({
      zoom: frame.zoom,
      panX: drag.current.panX + (event.clientX - drag.current.x),
      panY: drag.current.panY + (event.clientY - drag.current.y),
    });
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.12 : 0.12;
    move({ ...frame, zoom: frame.zoom + delta });
  };

  return (
    <div className="avatar-crop-overlay" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
      <div className="panel avatar-crop">
        <h2 id="avatar-crop-title">Recadre ton avatar</h2>
        <p className="muted recap-help">Glisse pour cadrer, molette ou curseur pour zoomer.</p>
        <canvas
          ref={canvasRef}
          className="avatar-crop-stage"
          width={VIEW}
          height={VIEW}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
        />
        <label className="avatar-crop-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={frame.zoom}
            onChange={(e) => move({ ...frame, zoom: Number(e.target.value) })}
          />
        </label>
        <div className="avatar-crop-actions">
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={onCancel}>
            Annuler
          </button>
          <button
            className="btn btn-gold"
            type="button"
            disabled={busy}
            onClick={() => onConfirm(exportAvatarDataUrl(image, frame))}
          >
            {busy ? "Enregistrement…" : "Utiliser"}
          </button>
        </div>
      </div>
    </div>
  );
}
