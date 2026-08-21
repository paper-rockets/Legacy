# Master 3D Model Instancing & Color Optimization Prompt

Use this specification and prompt whenever you need to process, convert, separate, or optimize raw 3D assets (trees, vegetation, foliage, props, buildings, characters, candies) into high-performance, single-mesh GPU-instanced models.

---

## Copy-Paste AI Prompt

```markdown
Convert and optimize all 3D models in [SPECIFY FOLDER PATH] for GPU instanced rendering. Follow these strict technical requirements:

1. Single Mesh & 1 Draw Call Architecture:
- Merge all sub-nodes, children, and separate primitives into exactly 1 Mesh / 1 BufferGeometry per model.
- Every model must execute in exactly 1 draw call.

2. True Color & Texture Preservation:
- If merging textured parts (e.g., foliage using a texture atlas) and untextured parts (e.g., solid wood bark material), bake the exact diffuse colors per-vertex directly into COLOR_0 so that:
  a) All multi-tone gradients, branch tiers, leaf colors, and textures display with 100% fidelity.
  b) Trunk and bark preserve their rich wood brown tones without UV texture bleeding.
- Ensure material baseColorFactor is [1.0, 1.0, 1.0, 1.0] and alphaMode is set to OPAQUE (or MASK with alphaCutoff 0.5 for leaf cutouts).
- Set doubleSided: true, roughness: 0.7 to 0.8, and metalness: 0.0.

3. Spatial Centering & Grounding:
- Calculate the exact bounding box of the merged vertices.
- Center the model horizontally at (X = 0, Z = 0).
- Ground the bottom-most vertex at Y = 0 (no floating, no subterranean offset).

4. Instancing Vertex Attributes:
- Inject a custom SCALAR vertex attribute named _IS_CANOPY:
  - Set to 1.0 for all foliage, leaves, canopy, and upper vegetation vertices.
  - Set to 0.0 for trunk, bark, stems, and ground contact vertices.
  - This allows the shader to dynamically color/tint foliage at runtime without affecting the trunk.

5. Geometry Normal Smoothing:
- Calculate position-averaged smooth vertex normals across organic canopy surfaces to eliminate faceted polygonal edges and produce soft, rounded foliage shading.

6. Validation & Dual Output:
- Validate glTF 2.0 compliance (ensure samplers array is declared and EXT_texture_webp is properly registered if WebP textures are embedded).
- Generate two synchronized output directories:
  1) Instanced/ - Uncompressed, high-fidelity master models ready for instanced meshes.
  2) Compressed/ - Draco + Meshopt compressed models for lightweight network delivery.
```

---

## Technical Specifications Table

| Parameter | Specification | Details |
|---|---|---|
| Draw Calls | Exactly 1 draw call | 1 single BufferGeometry primitive per GLB |
| Color System | Per-Vertex Baking (`COLOR_0`) | Diffuse texture colors + material factors baked directly to vertex colors |
| Canopy Shading | Position-Averaged Smooth Normals | Eliminates faceted low-poly look for soft, stylized, rounded shading |
| Origin Alignment | Horizontal Centering + Grounding | Centered at `(X=0, Z=0)` with bottom-most point at `Y=0` |
| Shader Custom Tag | `_IS_CANOPY` Scalar Attribute | `1.0` for foliage/leaves/canopy, `0.0` for trunk/bark/stems |
| Material Configuration | `alphaMode: "OPAQUE"` / `"MASK"` | `doubleSided: true`, `roughness: 0.7-0.8`, `metalness: 0.0` |
| glTF Validation | 0 Errors / 0 Warnings | Complete sampler array and `EXT_texture_webp` registration |
| Dual Output | `Instanced/` & `Compressed/` | Uncompressed master + Draco/Meshopt compressed versions |

---

## Automation Script Template (Node.js + gltf-transform)

```javascript
const fs = require('fs');
const path = require('path');
const { NodeIO, Document } = require('@gltf-transform/core');
const {
    KHRDracoMeshCompression,
    EXTTextureWebP,
    EXTMeshoptCompression,
    KHRMaterialsUnlit,
    KHRMaterialsEmissiveStrength,
    KHRLightsPunctual,
    KHRMeshQuantization,
    KHRTextureTransform
} = require('@gltf-transform/extensions');
const { weld, draco, prune, dedup } = require('@gltf-transform/functions');
const draco3d = require('draco3d');
const meshopt = require('meshoptimizer');
const sharp = require('sharp');

async function processModel(inputGlbPath, outputInstancedPath, outputCompressedPath) {
    const io = new NodeIO().registerExtensions([
        KHRDracoMeshCompression,
        EXTTextureWebP,
        EXTMeshoptCompression,
        KHRMaterialsUnlit,
        KHRMaterialsEmissiveStrength,
        KHRLightsPunctual,
        KHRMeshQuantization,
        KHRTextureTransform
    ]).registerDependencies({
        'draco3d.decoder': await draco3d.createDecoderModule(),
        'draco3d.encoder': await draco3d.createEncoderModule(),
        'meshopt.decoder': meshopt.MeshoptDecoder,
        'meshopt.encoder': meshopt.MeshoptEncoder
    });

    const doc = await io.read(inputGlbPath);
    const root = doc.getRoot();

    // 1. Extract texture pixels if textured
    let imgData = null, imgInfo = null;
    const textures = root.listTextures();
    if (textures.length > 0) {
        const texBuffer = textures[0].getImage();
        const res = await sharp(texBuffer).raw().toBuffer({ resolveWithObject: true });
        imgData = res.data;
        imgInfo = res.info;
    }

    // 2. Gather all primitives
    const collectedPrims = [];
    for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            if (!pos) continue;
            const norm = prim.getAttribute('NORMAL');
            const uv = prim.getAttribute('TEXCOORD_0');
            const idx = prim.getIndices();
            const mat = prim.getMaterial();
            const matName = (mat?.getName() || '').toLowerCase();
            const matColor = mat?.getBaseColorFactor() || [0.2, 0.1, 0.05, 1.0];
            const hasTex = !!mat?.getBaseColorTexture();

            const count = pos.getCount();
            const posArr = pos.getArray();
            const uvArr = uv ? uv.getArray() : null;
            const colorArr = new Float32Array(count * 4);
            const isCanopy = !matName.includes('wood') && !matName.includes('trunk') && !matName.includes('bark');

            for (let i = 0; i < count; i++) {
                if (hasTex && uvArr && imgData) {
                    const u = uvArr[i * 2], v = uvArr[i * 2 + 1];
                    let uNorm = u - Math.floor(u);
                    let vNorm = v - Math.floor(v);
                    let px = Math.min(imgInfo.width - 1, Math.max(0, Math.floor(uNorm * imgInfo.width)));
                    let py = Math.min(imgInfo.height - 1, Math.max(0, Math.floor((1 - vNorm) * imgInfo.height)));
                    let pIdx = (py * imgInfo.width + px) * imgInfo.channels;
                    colorArr[i * 4] = imgData[pIdx] / 255.0;
                    colorArr[i * 4 + 1] = imgData[pIdx + 1] / 255.0;
                    colorArr[i * 4 + 2] = imgData[pIdx + 2] / 255.0;
                    colorArr[i * 4 + 3] = 1.0;
                } else {
                    colorArr[i * 4] = matColor[0];
                    colorArr[i * 4 + 1] = matColor[1];
                    colorArr[i * 4 + 2] = matColor[2];
                    colorArr[i * 4 + 3] = 1.0;
                }
            }

            collectedPrims.push({
                isCanopy,
                pos: posArr,
                norm: norm ? norm.getArray() : null,
                colors: colorArr,
                idx: idx ? idx.getArray() : null,
                count
            });
        }
    }

    // 3. Merge primitives into single BufferGeometry
    let totalVerts = 0, totalIndices = 0;
    for (const cp of collectedPrims) {
        totalVerts += cp.count;
        totalIndices += cp.idx ? cp.idx.length : cp.count;
    }

    const mergedPos = new Float32Array(totalVerts * 3);
    const mergedNorm = new Float32Array(totalVerts * 3);
    const mergedColors = new Float32Array(totalVerts * 4);
    const mergedIsCanopy = new Float32Array(totalVerts);
    const mergedIndices = totalVerts > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

    let vOffset = 0, iOffset = 0;
    for (const cp of collectedPrims) {
        if (cp.idx) {
            for (let i = 0; i < cp.idx.length; i++) mergedIndices[iOffset++] = cp.idx[i] + vOffset;
        } else {
            for (let i = 0; i < cp.count; i++) mergedIndices[iOffset++] = i + vOffset;
        }
        for (let i = 0; i < cp.count; i++) {
            mergedPos[(vOffset + i) * 3] = cp.pos[i * 3];
            mergedPos[(vOffset + i) * 3 + 1] = cp.pos[i * 3 + 1];
            mergedPos[(vOffset + i) * 3 + 2] = cp.pos[i * 3 + 2];
            if (cp.norm) {
                mergedNorm[(vOffset + i) * 3] = cp.norm[i * 3];
                mergedNorm[(vOffset + i) * 3 + 1] = cp.norm[i * 3 + 1];
                mergedNorm[(vOffset + i) * 3 + 2] = cp.norm[i * 3 + 2];
            } else {
                mergedNorm[(vOffset + i) * 3 + 1] = 1.0;
            }
            mergedColors[(vOffset + i) * 4] = cp.colors[i * 4];
            mergedColors[(vOffset + i) * 4 + 1] = cp.colors[i * 4 + 1];
            mergedColors[(vOffset + i) * 4 + 2] = cp.colors[i * 4 + 2];
            mergedColors[(vOffset + i) * 4 + 3] = 1.0;
            mergedIsCanopy[vOffset + i] = cp.isCanopy ? 1.0 : 0.0;
        }
        vOffset += cp.count;
    }

    // 4. Center horizontally and ground at Y=0
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < totalVerts; i++) {
        minX = Math.min(minX, mergedPos[i * 3]); maxX = Math.max(maxX, mergedPos[i * 3]);
        minY = Math.min(minY, mergedPos[i * 3 + 1]); maxY = Math.max(maxY, mergedPos[i * 3 + 1]);
        minZ = Math.min(minZ, mergedPos[i * 3 + 2]); maxZ = Math.max(maxZ, mergedPos[i * 3 + 2]);
    }
    const cx = (minX + maxX) / 2, by = minY, cz = (minZ + maxZ) / 2;
    for (let i = 0; i < totalVerts; i++) {
        mergedPos[i * 3] -= cx;
        mergedPos[i * 3 + 1] -= by;
        mergedPos[i * 3 + 2] -= cz;
    }

    // 5. Build clean output document
    const outDoc = new Document();
    const buffer = outDoc.createBuffer('buffer');
    const outScene = outDoc.createScene('Scene');
    const outMat = outDoc.createMaterial('Material')
        .setAlphaMode('OPAQUE')
        .setDoubleSided(true)
        .setRoughnessFactor(0.7)
        .setMetallicFactor(0.0)
        .setBaseColorFactor([1.0, 1.0, 1.0, 1.0]);

    const outPrim = outDoc.createPrimitive()
        .setMode(4)
        .setMaterial(outMat)
        .setIndices(outDoc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(mergedIndices))
        .setAttribute('POSITION', outDoc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(mergedPos))
        .setAttribute('NORMAL', outDoc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(mergedNorm))
        .setAttribute('COLOR_0', outDoc.createAccessor().setBuffer(buffer).setType('VEC4').setArray(mergedColors))
        .setAttribute('_IS_CANOPY', outDoc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(mergedIsCanopy));

    const baseName = path.basename(inputGlbPath, '.glb');
    const outMesh = outDoc.createMesh(baseName).addPrimitive(outPrim);
    const outNode = outDoc.createNode(baseName).setMesh(outMesh);
    outScene.addChild(outNode);

    // Save uncompressed instanced version
    await io.write(outputInstancedPath, outDoc);

    // Save Draco compressed version
    await outDoc.transform(
        weld({ tolerance: 0.0001 }),
        prune(),
        dedup(),
        draco({
            quantizePosition: 14,
            quantizeNormal: 10,
            quantizeColor: 8
        })
    );
    await io.write(outputCompressedPath, outDoc);
}
```
