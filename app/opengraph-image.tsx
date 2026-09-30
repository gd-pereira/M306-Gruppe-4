import { ImageResponse } from "next/og";
import {
  ARROW_PATH,
  FLUX_AMBER,
  FLUX_INK,
  LOGO_VIEWBOX,
  RAYS_PATH,
  SUN_PATH,
  WORDMARK_PATH,
} from "@/components/brand/flux-logo";

export const alt = "Flux";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const logoWidth = 640;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: FLUX_INK,
      }}
    >
      <svg
        width={logoWidth}
        height={(logoWidth * LOGO_VIEWBOX.height) / LOGO_VIEWBOX.width}
        viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
      >
        <path d={SUN_PATH} fill={FLUX_AMBER} />
        <path d={RAYS_PATH} fill={FLUX_AMBER} />
        <path d={ARROW_PATH} fill="#FFFFFF" />
        <path d={WORDMARK_PATH} fill="#FFFFFF" />
      </svg>
    </div>,
    size,
  );
}
