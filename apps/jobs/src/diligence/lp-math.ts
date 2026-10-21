/** Read-only LP inventory scenarios. USDC=USD is a scenario assumption, not an oracle. */
export function roundedRange(price: number, fraction: number, stepBps: number, decimalsShift = 1000) {
  const base = 1 + stepBps / 10000;
  const lower = Math.floor(Math.log(price * (1 - fraction) / decimalsShift) / Math.log(base));
  const upper = Math.ceil(Math.log(price * (1 + fraction) / decimalsShift) / Math.log(base));
  return { lower, upper, lowerPrice: base ** lower * decimalsShift, upperPrice: base ** upper * decimalsShift, count: upper - lower + 1 };
}

export function concentratedPosition(price: number, lower: number, upper: number, budget = 10, changes = [-0.5, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5]) {
  const s = Math.sqrt(price), a = Math.sqrt(lower), b = Math.sqrt(upper);
  const unitX = 1 / s - 1 / b, unitY = s - a;
  const liquidity = budget / (price * unitX + unitY);
  const x = unitX * liquidity, y = unitY * liquidity;
  return { x, y, liquidity,
    scenarios: changes.map(change => {
      const p = price * (1 + change), sp = Math.sqrt(Math.max(lower, Math.min(upper, p)));
      const sol = liquidity * (1 / sp - 1 / b), usdc = liquidity * (sp - a);
      const valueUsd = sol * p + usdc, holdUsd = x * p + y;
      return { change, price: p, sol, usdc, valueUsd, holdUsd, differenceVsHoldUsd: valueUsd - holdUsd, inRange: p >= lower && p < upper, feesUsd: 0 };
    }) };
}

/** Custom equal initial USD per bin. Above active all SOL; below all USDC;
 * active half USD in each. This deliberately states its distribution rather than
 * claiming a generic DLMM/Spot strategy is 50:50. Atomic floors leave dust idle. */
export function discretePosition(price: number, activeId: number, stepBps: number, lower: number, upper: number, budget = 10, changes = [-0.5, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5]) {
  const count = upper - lower + 1, perBin = budget / count;
  const bins = Array.from({ length: count }, (_, i) => {
    const id = lower + i, binPrice = (1 + stepBps / 10000) ** id * 1000;
    const solAtoms = Math.floor((id > activeId ? perBin / price : id === activeId ? perBin / price / 2 : 0) * 1e9);
    const usdcAtoms = Math.floor((id < activeId ? perBin : id === activeId ? perBin / 2 : 0) * 1e6);
    return { id, price: binPrice, solAtoms, usdcAtoms };
  });
  const inputSolAtoms = bins.reduce((n, b) => n + b.solAtoms, 0), inputUsdcAtoms = bins.reduce((n, b) => n + b.usdcAtoms, 0);
  // add_liquidity2 uses integer basis-point weights per token. Largest-remainder
  // apportionment sums to 10000; resulting atomic amounts are rounded down.
  function weights(key: 'solAtoms' | 'usdcAtoms', total: number) {
    if (total === 0) return bins.map(() => 0);
    const exact = bins.map(b => b[key] / total * 10000), result = exact.map(Math.floor);
    const order = exact.map((x, i) => ({ i, remainder: x - result[i]! })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    for (let left = 10000 - result.reduce((a, b) => a + b, 0), i = 0; i < left; i++) result[order[i]!.i]!++;
    return result;
  }
  const wx = weights('solAtoms', inputSolAtoms), wy = weights('usdcAtoms', inputUsdcAtoms);
  const encodedBins = bins.map((b, i) => ({ ...b, solAtoms: Math.floor(inputSolAtoms * wx[i]! / 10000), usdcAtoms: Math.floor(inputUsdcAtoms * wy[i]! / 10000), distributionXBps: wx[i]!, distributionYBps: wy[i]! }));
  const solAtoms = encodedBins.reduce((n, b) => n + b.solAtoms, 0), usdcAtoms = encodedBins.reduce((n, b) => n + b.usdcAtoms, 0);
  const sol = solAtoms / 1e9, usdc = usdcAtoms / 1e6;
  const deployedUsd = sol * price + usdc;
  return { distribution: 'equal initial USD per bin, apportioned to 10000 basis points per token; active half SOL/half USDC', inputSolAtoms, inputUsdcAtoms, solAtoms, usdcAtoms, sol, usdc, deployedUsd, idleDustUsd: budget - deployedUsd, bins: encodedBins,
    scenarios: changes.map(change => {
      const p = price * (1 + change);
      let x = 0, y = 0;
      for (const b of encodedBins) {
        const bx = b.solAtoms / 1e9, by = b.usdcAtoms / 1e6;
        if (change > 0 && p > b.price) y += by + bx * b.price;
        else if (change < 0 && p < b.price) x += bx + by / b.price;
        else { x += bx; y += by; }
      }
      const valueUsd = x * p + y + budget - deployedUsd, holdUsd = sol * p + usdc + budget - deployedUsd;
      return { change, price: p, sol: x, usdc: y, valueUsd, holdUsd, differenceVsHoldUsd: valueUsd - holdUsd, inRange: p >= bins[0]!.price && p <= bins.at(-1)!.price, feesUsd: 0 };
    }) };
}

export function dynamicPositionSizes(binCount: number, headerSize: number, extendedBinSize: number) {
  const chunks: number[] = [];
  for (let left = binCount; left > 0; left -= 1400) {
    const bins = Math.min(1400, left);
    chunks.push(headerSize + Math.max(0, bins - 70) * extendedBinSize);
  }
  return chunks;
}
