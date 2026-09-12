import { useMemo } from "react";
import { AdditiveBlending, Color, ShaderMaterial } from "three";

/** Crisp pixel-ish stars — replaces soft drei Stars blobs. */
export default function CrispStarfield({
  count = 9000,
  radius = 110,
  depth = 70,
}: {
  count?: number;
  radius?: number;
  depth?: number;
}) {
  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const tint = new Color();

    for (let i = 0; i < count; i += 1) {
      // Stable-ish distribution on a thick spherical shell.
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius + Math.random() * depth;
      const sinP = Math.sin(phi);
      positions[i * 3] = r * sinP * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * sinP * Math.sin(theta);

      const roll = Math.random();
      if (roll < 0.06) {
        sizes[i] = 2.4;
        tint.setRGB(0.92, 0.95, 1);
      } else if (roll < 0.2) {
        sizes[i] = 1.55;
        tint.setRGB(0.78, 0.86, 1);
      } else if (roll < 0.28) {
        sizes[i] = 1.35;
        tint.setHSL(0.08 + Math.random() * 0.06, 0.35, 0.86);
      } else {
        sizes[i] = 0.9 + Math.random() * 0.35;
        tint.setRGB(0.62 + Math.random() * 0.2, 0.7 + Math.random() * 0.2, 0.88 + Math.random() * 0.1);
      }
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    return { positions, colors, sizes };
  }, [count, depth, radius]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        vertexColors: true,
        uniforms: {},
        vertexShader: /* glsl */ `
          attribute float aSize;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            // Fixed pixel size — no perspective inflation (that made soft blobs).
            gl_PointSize = aSize * (0.75 + 0.35 * clamp(-80.0 / mvPosition.z, 0.65, 1.35));
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float d = dot(p, p);
            if (d > 1.0) discard;
            // Hard core, tiny falloff — reads as a star, not a smudge.
            float core = smoothstep(1.0, 0.15, d);
            float spike = exp(-d * 7.0);
            float a = mix(spike * 0.55, 1.0, core * core);
            gl_FragColor = vec4(vColor * (0.75 + 0.45 * core), a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  );

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}
