const THREE = require('three');
const geom = new THREE.ConeGeometry(1 / Math.SQRT2, 8, 4, 1, false, Math.PI/4);
const pos = geom.attributes.position.array;
for(let i=0; i<pos.length; i+=3) {
    if (Math.abs(pos[i+1] - (-4)) < 0.1) {
        console.log(pos[i].toFixed(2), pos[i+1].toFixed(2), pos[i+2].toFixed(2));
    }
}
