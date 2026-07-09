import * as THREE from "three";
import { getAd, type AdCreative } from "../ads/catalog";

export interface BillboardSlot {
  x: number;
  z: number;
  /** rotation around Y in radians (0 = faces +Z) */
  rotY: number;
  width: number;
  height: number;
  /** ad creative id from catalog */
  adId: string;
  /** freestanding poles vs wall-mounted poster */
  style?: "tower" | "wall";
}

/** Draw a crisp ad texture onto a canvas (power-of-two friendly). */
export function createAdTexture(ad: AdCreative, w = 1024, h = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // gradient background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, ad.bg);
  grad.addColorStop(1, ad.bg2 ?? ad.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // accent stripe
  ctx.fillStyle = ad.accent;
  ctx.fillRect(0, 0, 18, h);
  ctx.fillRect(0, h - 14, w, 14);

  // subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let i = 0; i < w; i += 48) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
  }

  // brand
  ctx.fillStyle = ad.accent;
  ctx.font = "bold 42px system-ui, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(ad.brand.toUpperCase(), 56, 90);

  // headline
  ctx.fillStyle = ad.text;
  ctx.font = "bold 78px system-ui, Arial, sans-serif";
  wrapText(ctx, ad.headline, 56, 200, w - 100, 84);

  // subline
  if (ad.subline) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "36px system-ui, Arial, sans-serif";
    ctx.fillText(ad.subline, 56, h - 90);
  }

  // CTA pill
  if (ad.cta) {
    ctx.fillStyle = ad.accent;
    const cta = ad.cta.toUpperCase();
    ctx.font = "bold 28px system-ui, Arial, sans-serif";
    const tw = ctx.measureText(cta).width;
    const px = 56;
    const py = h - 48;
    roundRect(ctx, px, py - 28, tw + 36, 40, 8);
    ctx.fill();
    ctx.fillStyle = ad.bg;
    ctx.fillText(cta, px + 18, py);
  }

  // "Ad" badge (transparency / disclosure)
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, w - 70, 16, 54, 26, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 16px system-ui, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AD", w - 43, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, cy);
      line = word + " ";
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, cy);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function buildBillboardMesh(slot: BillboardSlot): THREE.Group {
  const ad = getAd(slot.adId);
  const group = new THREE.Group();
  group.position.set(slot.x, 0, slot.z);
  group.rotation.y = slot.rotY;
  group.userData = { adId: slot.adId, isAd: true };

  const tex = createAdTexture(ad);
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.45,
    metalness: 0.05,
    emissive: new THREE.Color(ad.accent),
    emissiveMap: tex,
    emissiveIntensity: 0.18,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.6,
    metalness: 0.4,
  });
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.5,
    metalness: 0.55,
  });

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(slot.width, slot.height, 0.18),
    [frameMat, frameMat, frameMat, frameMat, faceMat, frameMat],
  );
  board.position.y = slot.height / 2 + (slot.style === "wall" ? 1.2 : 2.2);
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  // thin frame lip
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(slot.width + 0.25, slot.height + 0.25, 0.08),
    frameMat,
  );
  lip.position.copy(board.position);
  lip.position.z += 0.02;
  group.add(lip);

  if (slot.style !== "wall") {
    // dual poles
    const poleH = board.position.y - slot.height / 2;
    for (const ox of [-slot.width * 0.35, slot.width * 0.35]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, poleH, 8),
        poleMat,
      );
      pole.position.set(ox, poleH / 2, 0);
      pole.castShadow = true;
      group.add(pole);
    }
    // base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(slot.width * 0.9, 0.2, 0.5),
      poleMat,
    );
    base.position.y = 0.1;
    group.add(base);
  }

  return group;
}

export function buildWallPoster(
  x: number,
  y: number,
  z: number,
  rotY: number,
  width: number,
  height: number,
  adId: string,
): THREE.Mesh {
  const ad = getAd(adId);
  const tex = createAdTexture(ad, 512, 512);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.55,
    metalness: 0.02,
    emissive: new THREE.Color(ad.accent),
    emissiveMap: tex,
    emissiveIntensity: 0.12,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.userData = { adId, isAd: true };
  return mesh;
}
