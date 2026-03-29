import { MeshGradient } from "@paper-design/shaders-react"

/**
 * Animated WebGL mesh-gradient background for the hero section.
 * Colors are tuned to the Deductly palette: warm mahogany darks + jewel gold.
 * Render this as an absolute full-cover layer behind all hero content.
 */
export function HeroBackground() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      {/* Primary flowing mesh — warm darks with gold accent blobs */}
      <MeshGradient
        className="absolute inset-0 w-full h-full"
        colors={[
          "#0D0B09",  // warm near-black (dominant base)
          "#1C1508",  // deep warm dark
          "#C8900A",  // brand gold accent
          "#311E05",  // dark amber shadow
          "#A67508",  // deeper gold
        ]}
        speed={0.22}
        distortion={0.35}
        swirl={0.12}
        grainMixer={0.06}
      />

      {/* Dark vignette overlay — keeps text readable, deepens edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 70% at 50% 50%, transparent 30%, rgba(10,8,6,0.55) 100%)",
        }}
      />
    </div>
  )
}
