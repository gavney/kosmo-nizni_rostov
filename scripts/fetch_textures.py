from pathlib import Path
import urllib.request

out = Path(__file__).resolve().parents[1] / "frontend" / "public" / "textures"
out.mkdir(parents=True, exist_ok=True)

ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PolarMesh/1.0"
opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", ua)]
urllib.request.install_opener(opener)

jobs = {
    "earth-day.jpg": [
        "https://unpkg.com/three-globe@2.44.1/example/img/earth-blue-marble.jpg",
        "https://cdn.jsdelivr.net/npm/three-globe@2.44.1/example/img/earth-blue-marble.jpg",
    ],
    "earth-night.jpg": [
        "https://unpkg.com/three-globe@2.44.1/example/img/earth-night.jpg",
        "https://cdn.jsdelivr.net/npm/three-globe@2.44.1/example/img/earth-night.jpg",
    ],
    "earth-clouds.jpg": [
        "https://clouds.matteason.co.uk/images/4096x2048/clouds.jpg",
        "https://clouds.matteason.co.uk/images/8192x4096/clouds.jpg",
    ],
    "earth-specular.png": [
        "https://unpkg.com/three-globe@2.44.1/example/img/earth-water.png",
        "https://cdn.jsdelivr.net/npm/three-globe@2.44.1/example/img/earth-water.png",
    ],
    "milky-way.jpg": [
        "https://unpkg.com/three@0.170.0/examples/textures/cube/MilkyWay/dark-s_pz.jpg",
        "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/cube/MilkyWay/dark-s_pz.jpg",
    ],
}

for name, urls in jobs.items():
    dest = out / name
    ok = False
    for url in urls:
        try:
            print("TRY", name, url, flush=True)
            urllib.request.urlretrieve(url, dest)
            size = dest.stat().st_size
            if size < 1000:
                print(" SMALL", size, flush=True)
                dest.unlink(missing_ok=True)
                continue
            print(" OK", size, flush=True)
            ok = True
            break
        except Exception as e:
            print(" FAIL", e, flush=True)
    if not ok:
        print("MISSING", name, flush=True)
        raise SystemExit(1)
