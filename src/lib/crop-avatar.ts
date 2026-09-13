export const AVATAR_EXPORT_SIZE = 256;
export const MAX_AVATAR_UPLOAD_BYTES = 8 * 1024 * 1024;

export type CropFrame = {
  zoom: number;
  panX: number;
  panY: number;
};

export function defaultCoverZoom(img: { width: number; height: number }, view: number): number {
  if (!img.width || !img.height) return 1;
  return Math.max(view / img.width, view / img.height);
}

export function clampPan(img: { width: number; height: number }, view: number, frame: CropFrame): CropFrame {
  const cover = defaultCoverZoom(img, view);
  const zoom = Math.max(1, Math.min(3, frame.zoom));
  const drawW = img.width * cover * zoom;
  const drawH = img.height * cover * zoom;
  const maxX = Math.max(0, (drawW - view) / 2);
  const maxY = Math.max(0, (drawH - view) / 2);
  return {
    zoom,
    panX: Math.min(maxX, Math.max(-maxX, frame.panX)),
    panY: Math.min(maxY, Math.max(-maxY, frame.panY)),
  };
}

export function drawCroppedAvatar(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  view: number,
  frame: CropFrame,
) {
  const next = clampPan(img, view, frame);
  const cover = defaultCoverZoom(img, view);
  const drawW = img.width * cover * next.zoom;
  const drawH = img.height * cover * next.zoom;
  ctx.clearRect(0, 0, view, view);
  ctx.drawImage(img, view / 2 - drawW / 2 + next.panX, view / 2 - drawH / 2 + next.panY, drawW, drawH);
}

export function exportAvatarDataUrl(
  img: CanvasImageSource & { width: number; height: number },
  frame: CropFrame,
  size = AVATAR_EXPORT_SIZE,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  drawCroppedAvatar(ctx, img, size, frame);
  return canvas.toDataURL("image/jpeg", 0.86);
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Choisis une image (JPEG, PNG ou WebP)."));
  }
  if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
    return Promise.reject(new Error("Image trop lourde (8 Mo max.)."));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.width || !img.height) {
        reject(new Error("Image illisible."));
        return;
      }
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire cette image."));
    };
    img.src = url;
  });
}
