export interface CanvasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelSource {
  width: number;
  height: number;
  getImageData: () => Uint8ClampedArray;
}

export function getCandidateRegions(source: PixelSource): CanvasRegion[] {
  const regions: CanvasRegion[] = [{ x: 0, y: 0, width: source.width, height: source.height }];
  const brightSquare = findBrightSquareRegion(source);
  if (brightSquare) {
    regions.push(
      brightSquare,
      padRegion(brightSquare, source, 8),
      padRegion(brightSquare, source, 16),
      padRegion(brightSquare, source, 32),
      padRegion(brightSquare, source, 48)
    );
  }
  regions.push(...getCoverageSquareRegions(source));
  return dedupeRegions(regions);
}

function findBrightSquareRegion(source: PixelSource): CanvasRegion | null {
  const data = source.getImageData();
  const rowThreshold = Math.max(32, source.width * 0.25);
  const rows: number[] = [];

  for (let y = 0; y < source.height; y += 1) {
    let brightPixels = 0;
    for (let x = 0; x < source.width; x += 1) {
      if (isBrightPixel(data, source.width, x, y)) {
        brightPixels += 1;
      }
    }
    if (brightPixels >= rowThreshold) {
      rows.push(y);
    }
  }

  let best: CanvasRegion | null = null;
  const fullBrightRegion = getBrightRegionInBand(data, source.width, 0, source.height - 1);
  if (fullBrightRegion && isPlausibleQrSquare(fullBrightRegion, source)) {
    best = fullBrightRegion;
  }

  for (const band of contiguousBands(rows, Math.max(48, source.height * 0.08))) {
    const region = getBrightRegionInBand(data, source.width, band.start, band.end);
    if (!region || !isPlausibleQrSquare(region, source)) {
      continue;
    }
    if (!best || region.width * region.height > best.width * best.height) {
      best = region;
    }
  }

  return best;
}

function getBrightRegionInBand(
  data: Uint8ClampedArray,
  width: number,
  startY: number,
  endY: number
): CanvasRegion | null {
  let minX = width;
  let minY = endY;
  let maxX = 0;
  let maxY = startY;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isBrightPixel(data, width, x, y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function isBrightPixel(data: Uint8ClampedArray, width: number, x: number, y: number): boolean {
  const offset = (y * width + x) * 4;
  return data[offset] > 235 && data[offset + 1] > 235 && data[offset + 2] > 235;
}

function contiguousBands(rows: number[], minHeight: number): Array<{ start: number; end: number }> {
  const bands: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  let previous: number | null = null;

  for (const row of rows) {
    if (start === null) {
      start = row;
      previous = row;
      continue;
    }
    if (previous !== null && row > previous + 1) {
      if (previous - start + 1 >= minHeight) {
        bands.push({ start, end: previous });
      }
      start = row;
    }
    previous = row;
  }

  if (start !== null && previous !== null && previous - start + 1 >= minHeight) {
    bands.push({ start, end: previous });
  }

  return bands;
}

function isPlausibleQrSquare(region: CanvasRegion, source: PixelSource): boolean {
  const ratio = region.width / region.height;
  const minSide = Math.min(source.width, source.height) * 0.2;
  const maxSide = Math.max(source.width, source.height) * 0.95;
  return (
    ratio >= 0.75 &&
    ratio <= 1.25 &&
    region.width >= minSide &&
    region.height >= minSide &&
    region.width <= maxSide &&
    region.height <= maxSide
  );
}

function getCoverageSquareRegions(source: PixelSource): CanvasRegion[] {
  const shortSide = Math.min(source.width, source.height);
  const sizes = [0.9, 0.7, 0.52, 0.38, 0.27]
    .map((scale) => shortSide * scale)
    .filter((size) => size >= 48 || shortSide < 96);
  const centersX = getAxisCenters(source.width, source.height).map((scale) => source.width * scale);
  const centersY = getAxisCenters(source.height, source.width).map((scale) => source.height * scale);
  const regions: CanvasRegion[] = [];

  for (const size of sizes) {
    for (const centerX of centersX) {
      for (const centerY of centersY) {
        regions.push(
          clampRegion(
            {
              x: centerX - size / 2,
              y: centerY - size / 2,
              width: size,
              height: size
            },
            source
          )
        );
      }
    }
  }

  return regions;
}

function getAxisCenters(axis: number, otherAxis: number): number[] {
  return axis > otherAxis * 1.15 ? [0.18, 0.34, 0.5, 0.66, 0.82] : [0.25, 0.5, 0.75];
}

function padRegion(region: CanvasRegion, source: PixelSource, padding: number): CanvasRegion {
  return clampRegion(
    {
      x: region.x - padding,
      y: region.y - padding,
      width: region.width + padding * 2,
      height: region.height + padding * 2
    },
    source
  );
}

function clampRegion(region: CanvasRegion, source: PixelSource): CanvasRegion {
  const x = Math.max(0, region.x);
  const y = Math.max(0, region.y);
  return {
    x,
    y,
    width: Math.min(region.width, source.width - x),
    height: Math.min(region.height, source.height - y)
  };
}

function dedupeRegions(regions: CanvasRegion[]): CanvasRegion[] {
  const seen = new Set<string>();
  return regions.filter((region) => {
    const key = [
      Math.round(region.x),
      Math.round(region.y),
      Math.round(region.width),
      Math.round(region.height)
    ].join(':');
    if (seen.has(key) || region.width < 1 || region.height < 1) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
