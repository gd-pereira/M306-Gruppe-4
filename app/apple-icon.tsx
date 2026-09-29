import { ImageResponse } from "next/og";
import {
  ARROW_PATH,
  FLUX_AMBER,
  FLUX_INK,
  MARK_VIEWBOX,
  RAYS_PATH,
  SUN_PATH,
} from "@/components/brand/flux-logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
        }}
      >
        <svg
          width={128}
          height={(128 * MARK_VIEWBOX.height) / MARK_VIEWBOX.width}
          viewBox={`0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}
        >
          <path d={SUN_PATH} fill={FLUX_AMBER} />
          <path d={RAYS_PATH} fill={FLUX_AMBER} />
          <path d={ARROW_PATH} fill={FLUX_INK} />
        </svg>
      </div>
    ),
    size,
  );
}
