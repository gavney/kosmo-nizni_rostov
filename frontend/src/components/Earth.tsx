import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  BackSide,
  Color,
  Mesh,
  Vector3,
} from "three";

const DAY = "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg";
const NIGHT = "https://threejs.org/examples/textures/planets/earth_lights_2048.jpg";

const earthVert = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const earthFrag = `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform vec3 sunDirection;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  float light = dot(normalize(vNormal), normalize(sunDirection));
  float f = smoothstep(-0.08, 0.18, light);
  vec3 day = texture2D(dayMap, vUv).rgb;
  vec3 night = texture2D(nightMap, vUv).rgb * vec3(1.15, 1.05, 0.85);
  vec3 color = mix(night * 0.55, day, f);
  float rim = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.4);
  color += vec3(0.12, 0.28, 0.32) * rim * 0.25;
  gl_FragColor = vec4(color, 1.0);
}
`;

const atmoVert = `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const atmoFrag = `
uniform float pulse;
varying vec3 vNormal;
void main() {
  float rim = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
  gl_FragColor = vec4(0.25, 0.72, 0.78, rim * (0.38 + pulse * 0.08));
}
`;

export default function Earth({ sun }: { sun: [number, number, number] }) {
  const dayMap = useTexture(DAY);
  const nightMap = useTexture(NIGHT);
  const earthRef = useRef<Mesh>(null);
  const atmoRef = useRef<Mesh>(null);
  const uniforms = useMemo(
    () => ({
      dayMap: { value: dayMap },
      nightMap: { value: nightMap },
      sunDirection: { value: new Vector3(...sun) },
    }),
    [dayMap, nightMap],
  );
  const atmoUniforms = useMemo(
    () => ({ pulse: { value: 0 } }),
    [],
  );

  useFrame(({ clock }) => {
    uniforms.sunDirection.value.set(sun[0], sun[1], sun[2]);
    atmoUniforms.pulse.value = Math.sin(clock.elapsedTime * 0.7) * 0.5 + 0.5;
    if (atmoRef.current) {
      const s = 1.045 + Math.sin(clock.elapsedTime * 0.5) * 0.004;
      atmoRef.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 96, 96]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={earthVert}
          fragmentShader={earthFrag}
        />
      </mesh>
      <mesh ref={atmoRef} scale={1.045}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          uniforms={atmoUniforms}
          vertexShader={atmoVert}
          fragmentShader={atmoFrag}
          side={BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.002, 64, 64]} />
        <meshBasicMaterial color={new Color("#16323c")} transparent opacity={0.12} />
      </mesh>
    </group>
  );
}
