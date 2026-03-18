import { MeshGradient } from "@paper-design/shaders-react"

/**
 * Learnovo-branded MeshGradient shader background.
 * Fades out at every edge via a radial CSS mask so it blends
 * seamlessly into the surrounding white (or dark) page.
 */
export default function ShaderBackground({
  className = "",
  speed = 0.4,
  style = {},
}) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        /* Radial mask: fully opaque at centre, transparent at edges */
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
        maskImage:
          "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
        ...style,
      }}
    >
      <MeshGradient
        className="w-full h-full"
        colors={[
          "#99f6e4",   // light teal
          "#f0fdfa",   // very light teal tint
          "#ccfbf1",   // soft teal
          "#ffffff",   // white
        ]}
        speed={speed}
        backgroundColor="#ffffff"
      />
    </div>
  )
}
