import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  BackSide,
  FrontSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";

/**
 * Maps (public/textures):
 * - earth-day.jpg     Solar System Scope 8K → 4K runtime
 * - earth-night.jpg   NASA Black Marble → 4K runtime
 * - earth-clouds.jpg  satellite cloud composite 4K
 * - earth-specular.png ocean mask
 * - milky-way.jpg     sky backdrop
 */
const MAPS = {
  dayMap: "/textures/earth-day.jpg?v=4k",
  nightMap: "/textures/earth-night.jpg?v=4k",
  cloudMap: "/textures/earth-clouds.jpg?v=4k",
  specMap: "/textures/earth-specular.png",
  milky: "/textures/milky-way.jpg",
};

const earthVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const earthFrag = /* glsl */ `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform sampler2D specMap;
uniform vec3 sunDirection;
uniform vec3 cameraPos;
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 sun = normalize(sunDirection);
  vec3 viewDir = normalize(cameraPos - vWorldPos);
  float ndl = dot(n, sun);

  // Day — 8K NASA-based map, keep colors clear
  vec3 day = texture2D(dayMap, vUv).rgb;
  day = pow(day, vec3(0.9));
  day *= vec3(1.08, 1.04, 1.0);
  float lambert = max(ndl, 0.0);
  day *= 0.52 + 0.58 * pow(lambert, 0.4);

  // Night — unchanged (city lights)
  vec3 nightTex = texture2D(nightMap, vUv).rgb;
  float ocean = texture2D(specMap, vUv).r;
  float luma = max(max(nightTex.r, nightTex.g), nightTex.b);
  float cityMask = smoothstep(0.02, 0.12, luma);
  vec3 cities = nightTex * vec3(1.35, 1.05, 0.72) * (0.9 + 2.4 * cityMask);
  vec3 nightBase = vec3(0.004, 0.008, 0.016) * (1.0 - ocean * 0.55);
  vec3 nightColor = nightBase + cities;

  // Sharp terminator (Google Earth style) — narrow blend, no muddy dusk wash
  float dayF = smoothstep(-0.015, 0.06, ndl);
  float nightF = 1.0 - smoothstep(-0.01, 0.28, ndl);

  vec3 color = mix(nightColor, day, dayF);
  color += cities * nightF * 1.15;

  vec3 halfV = normalize(sun + viewDir);
  float spec = pow(max(dot(n, halfV), 0.0), 52.0) * ocean * dayF;
  color += spec * vec3(0.8, 0.9, 1.0) * 0.5;

  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.8);
  color += vec3(0.3, 0.55, 1.0) * fresnel * mix(0.03, 0.16, dayF);

  gl_FragColor = vec4(color, 1.0);
}
`;

const cloudVert = earthVert;

const cloudFrag = /* glsl */ `
uniform sampler2D cloudMap;
uniform vec3 sunDirection;
varying vec2 vUv;
varying vec3 vWorldNormal;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 sun = normalize(sunDirection);
  float ndl = dot(n, sun);
  // Match sharp terminator — clouds vanish quickly into night
  float dayF = smoothstep(-0.02, 0.12, ndl);

  float raw = texture2D(cloudMap, vUv).r;
  float wisps = smoothstep(0.25, 0.55, raw);
  float thick = smoothstep(0.58, 0.96, raw);
  float cover = mix(wisps * 0.3, 1.0, thick);

  vec3 dayCol = vec3(1.0, 1.0, 1.0);
  vec3 nightCol = vec3(0.05, 0.055, 0.07);
  vec3 lit = mix(nightCol, dayCol, dayF);
  lit *= 0.9 + 0.15 * pow(max(ndl, 0.0), 0.35);

  float alpha = cover * mix(0.0, 0.2, dayF);
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(lit, alpha);
}
`;

const atmoVert = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const atmoFrag = /* glsl */ `
uniform vec3 sunDirection;
uniform vec3 cameraPos;
uniform float intensity;
uniform float duskBoost;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 sun = normalize(sunDirection);
  vec3 view = normalize(cameraPos - vWorldPos);
  float ndv = max(dot(n, view), 0.0);
  float ndl = dot(n, sun);
  float rim = pow(1.0 - ndv, 3.2);
  float dayF = smoothstep(-0.3, 0.55, ndl);
  float dusk = exp(-ndl * ndl * 9.0);
  vec3 col = mix(vec3(0.1, 0.18, 0.42), vec3(0.42, 0.68, 1.0), dayF);
  col = mix(col, vec3(1.0, 0.55, 0.28), dusk * duskBoost);
  float alpha = rim * mix(0.05, intensity, dayF);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.8));
}
`;

const skyVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFrag = /* glsl */ `
uniform sampler2D milky;
varying vec2 vUv;
void main() {
  vec3 mw = texture2D(milky, vUv).rgb;
  mw = pow(mw, vec3(0.9)) * 0.55;
  mw *= vec3(0.75, 0.82, 1.1);
  gl_FragColor = vec4(mw, 1.0);
}
`;

function prepColorMap(tex: Texture, anisotropy: number) {
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
}

export default function Earth({ sun }: { sun: [number, number, number] }) {
  const maps = useTexture(MAPS);
  const ready = useRef(false);
  useLayoutEffect(() => {
    if (ready.current) return;
    ready.current = true;
    prepColorMap(maps.dayMap, 8);
    prepColorMap(maps.nightMap, 8);
    prepColorMap(maps.milky, 2);
    maps.cloudMap.colorSpace = LinearSRGBColorSpace;
    maps.cloudMap.anisotropy = 4;
    maps.cloudMap.minFilter = LinearMipmapLinearFilter;
    maps.cloudMap.magFilter = LinearFilter;
    maps.cloudMap.generateMipmaps = true;
    maps.cloudMap.needsUpdate = true;
    maps.specMap.colorSpace = LinearSRGBColorSpace;
    maps.specMap.anisotropy = 4;
  }, [maps]);

  const cloudsRef = useRef<Mesh>(null);
  const uniforms = useMemo(
    () => ({
      dayMap: { value: maps.dayMap },
      nightMap: { value: maps.nightMap },
      specMap: { value: maps.specMap },
      sunDirection: { value: new Vector3(...sun).normalize() },
      cameraPos: { value: new Vector3(0, 0, 2.55) },
    }),
    [maps.dayMap, maps.nightMap, maps.specMap],
  );
  const cloudUniforms = useMemo(
    () => ({
      cloudMap: { value: maps.cloudMap },
      sunDirection: { value: new Vector3(...sun).normalize() },
    }),
    [maps.cloudMap],
  );
  const atmoUniforms = useMemo(
    () => ({
      sunDirection: { value: new Vector3(...sun).normalize() },
      cameraPos: { value: new Vector3(0, 0, 2.55) },
      intensity: { value: 0.7 },
      duskBoost: { value: 0.25 },
    }),
    [],
  );
  const haloUniforms = useMemo(
    () => ({
      sunDirection: { value: new Vector3(...sun).normalize() },
      cameraPos: { value: new Vector3(0, 0, 2.55) },
      intensity: { value: 0.35 },
      duskBoost: { value: 0.12 },
    }),
    [],
  );
  const skyUniforms = useMemo(() => ({ milky: { value: maps.milky } }), [maps.milky]);

  useFrame(({ clock, camera }) => {
    const sx = sun[0];
    const sy = sun[1];
    const sz = sun[2];
    uniforms.sunDirection.value.set(sx, sy, sz).normalize();
    uniforms.cameraPos.value.copy(camera.position);
    cloudUniforms.sunDirection.value.set(sx, sy, sz).normalize();
    atmoUniforms.sunDirection.value.set(sx, sy, sz).normalize();
    atmoUniforms.cameraPos.value.copy(camera.position);
    haloUniforms.sunDirection.value.set(sx, sy, sz).normalize();
    haloUniforms.cameraPos.value.copy(camera.position);
    if (cloudsRef.current) cloudsRef.current.rotation.y = clock.elapsedTime * 0.0022;
  });

  return (
    <group>
      <mesh scale={80}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          uniforms={skyUniforms}
          vertexShader={skyVert}
          fragmentShader={skyFrag}
          side={BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={earthVert}
          fragmentShader={earthFrag}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={cloudsRef} scale={1.005}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          uniforms={cloudUniforms}
          vertexShader={cloudVert}
          fragmentShader={cloudFrag}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={1.016}>
        <sphereGeometry args={[1, 40, 40]} />
        <shaderMaterial
          uniforms={atmoUniforms}
          vertexShader={atmoVert}
          fragmentShader={atmoFrag}
          side={FrontSide}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={1.05}>
        <sphereGeometry args={[1, 32, 32]} />
        <shaderMaterial
          uniforms={haloUniforms}
          vertexShader={atmoVert}
          fragmentShader={atmoFrag}
          side={BackSide}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
