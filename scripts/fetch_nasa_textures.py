"""Download NASA-grade Earth textures for Polar Mesh globe."""
from __future__ import annotations

from pathlib import Path
import urllib.request

OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "textures"
OUT.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PolarMesh/1.0"
opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", UA), ("Accept", "image/*,*/*")]
urllib.request.install_opener(opener)

JOBS: dict[str, list[str]] = {
    # Solar System Scope 8K day map (NASA-based, sharp) — preferred for clarity
    "earth-day.jpg": [
        "https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_8k_earth_daymap.jpg",
        "https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg",
        "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg",
    ],
    # NASA Black Marble 2016 night lights (3km preferred)
    "earth-night.jpg": [
        "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg",
        "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg",
        "https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg",
    ],
    # Live satellite cloud composite 4K (grayscale, good for alpha)
    "earth-clouds.jpg": [
        "https://clouds.matteason.co.uk/images/4096x2048/clouds.jpg",
        "https://clouds.matteason.co.uk/images/8192x4096/clouds.jpg",
    ],
    # Ocean specular / water mask
    "earth-specular.png": [
        "https://unpkg.com/three-globe@2.44.1/example/img/earth-water.png",
        "https://cdn.jsdelivr.net/npm/three-globe@2.44.1/example/img/earth-water.png",
    ],
    "milky-way.jpg": [
        "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/cube/MilkyWay/dark-s_pz.jpg",
        "https://unpkg.com/three@0.160.0/examples/textures/cube/MilkyWay/dark-s_pz.jpg",
    ],
}


def fetch(name: str, urls: list[str]) -> None:
    dest = OUT / name
    for url in urls:
        try:
            print(f"TRY {name}\n  {url}", flush=True)
            urllib.request.urlretrieve(url, dest)
            size = dest.stat().st_size
            if size < 80_000:
                print(f"  SMALL {size}", flush=True)
                dest.unlink(missing_ok=True)
                continue
            print(f"  OK {size:,} bytes", flush=True)
            return
        except Exception as exc:
            print(f"  FAIL {exc}", flush=True)
    raise SystemExit(f"MISSING {name}")


def main() -> None:
    for name, urls in JOBS.items():
        fetch(name, urls)
    print("done", flush=True)


if __name__ == "__main__":
    main()
