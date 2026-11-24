import * as THREE from "three";

export interface CoupleRiders {
  group: THREE.Group;
  him: THREE.Group;
  her: THREE.Group;
  dispose: () => void;
}

function circleTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(image, 0, 0, size, size);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,244,220,0.92)";
      ctx.lineWidth = 14;
      ctx.stroke();
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => reject(new Error(url));
    image.src = url;
  });
}

function makeRider(shirt: string): { group: THREE.Group; materials: THREE.Material[]; geometries: THREE.BufferGeometry[] } {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const skin = new THREE.MeshStandardMaterial({
    color: "#f2c4a6",
    roughness: 0.52,
    metalness: 0.02,
  });
  const cloth = new THREE.MeshStandardMaterial({
    color: shirt,
    roughness: 0.64,
    metalness: 0.04,
  });
  materials.push(skin, cloth);

  const bodyGeom = new THREE.CapsuleGeometry(0.105, 0.2, 6, 12);
  const body = new THREE.Mesh(bodyGeom, cloth);
  body.position.y = 0.24;
  geometries.push(bodyGeom);
  group.add(body);

  const limbGeom = new THREE.CapsuleGeometry(0.034, 0.11, 4, 8);
  geometries.push(limbGeom);
  const armL = new THREE.Mesh(limbGeom, skin);
  armL.position.set(-0.16, 0.3, 0.03);
  armL.rotation.z = 0.55;
  const armR = new THREE.Mesh(limbGeom, skin);
  armR.position.set(0.16, 0.3, 0.03);
  armR.rotation.z = -0.55;
  group.add(armL, armR);

  const legGeom = new THREE.CapsuleGeometry(0.042, 0.06, 4, 8);
  geometries.push(legGeom);
  const legL = new THREE.Mesh(legGeom, cloth);
  legL.position.set(-0.06, 0.06, 0);
  const legR = new THREE.Mesh(legGeom, cloth);
  legR.position.set(0.06, 0.06, 0);
  group.add(legL, legR);

  return { group, materials, geometries };
}

export function createCoupleRiders(onFacesReady: () => void): CoupleRiders {
  const group = new THREE.Group();
  group.name = "couple-riders";
  group.visible = false;

  const himParts = makeRider("#1d4e89");
  const herParts = makeRider("#3db8c4");
  himParts.group.position.set(-0.3, 0, 0.04);
  herParts.group.position.set(0.3, 0, 0.04);
  group.add(himParts.group, herParts.group);
  group.position.set(0, 0.46, 0.16);

  const textures: THREE.Texture[] = [];
  const spriteMaterials: THREE.Material[] = [];
  let ready = 0;
  const attachFace = (rider: THREE.Group, url: string) => {
    void circleTexture(url)
      .then((texture) => {
        textures.push(texture);
        const material = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        });
        spriteMaterials.push(material);
        const sprite = new THREE.Sprite(material);
        sprite.position.set(0, 0.72, 0);
        sprite.scale.set(0.78, 0.78, 1);
        sprite.renderOrder = 3;
        sprite.name = url.includes("her") ? "face-her" : "face-him";
        rider.add(sprite);
        ready += 1;
        if (ready >= 2) onFacesReady();
      })
      .catch(() => {
        ready += 1;
        if (ready >= 2) onFacesReady();
      });
  };

  attachFace(himParts.group, "/couple-him.jpg");
  attachFace(herParts.group, "/couple-her.jpg");

  return {
    group,
    him: himParts.group,
    her: herParts.group,
    dispose: () => {
      for (const texture of textures) texture.dispose();
      for (const material of spriteMaterials) material.dispose();
      for (const material of [...himParts.materials, ...herParts.materials]) material.dispose();
      for (const geometry of [...himParts.geometries, ...herParts.geometries]) geometry.dispose();
    },
  };
}
