import * as THREE from 'three';

// One spherical skin with a front-only mouth wedge. Rotating two full hemispheres
// used to push their rear surfaces through one another. Here every rear vertex
// is fixed and the two mouth surfaces occupy only the front half (local z >= 0).
export class PacmanBody {
  constructor(radius = .67, rings = 28, segments = 64) {
    this.radius=radius;this.rings=rings;this.segments=segments;
    const positions=[],normals=[],uv=[],indices=[];
    for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
      positions.push(0,0,0);normals.push(0,0,0);uv.push(i/segments,j/rings);
      if(j<rings&&i<segments){const a=j*(segments+1)+i,b=a+1,c=a+segments+1;indices.push(a,b,c,b,c+1,c);}
    }
    this.skin=new THREE.BufferGeometry();this.skin.setIndex(indices);
    this.skin.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.skin.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    this.skin.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    this.mouths=[1,-1].map(()=>{
      const geo=new THREE.BufferGeometry(),points=new Float32Array((rings+1)*6),idx=[];
      for(let j=0;j<rings;j++){const a=j*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
      geo.setAttribute('position',new THREE.BufferAttribute(points,3));geo.setIndex(idx);return geo;
    });
    this.update(.06);
  }
  update(opening) {
    const angle=THREE.MathUtils.clamp(opening,.01,.55),r=this.radius;
    const p=this.skin.attributes.position,n=this.skin.attributes.normal;
    for(let j=0;j<=this.rings;j++){
      const theta=j/this.rings*Math.PI,x=r*Math.cos(theta),rad=r*Math.sin(theta);
      for(let i=0;i<=this.segments;i++){
        const base=i/this.segments*Math.PI*2;
        let phi=base;
        if(base<Math.PI/2)phi=angle+base*(1-angle/(Math.PI/2));
        else if(base>Math.PI*1.5)phi=Math.PI*2-angle-(Math.PI*2-base)*(1-angle/(Math.PI/2));
        const k=j*(this.segments+1)+i,y=rad*Math.sin(phi),z=rad*Math.cos(phi);
        p.setXYZ(k,x,y,z);n.setXYZ(k,x/r,y/r,z/r);
      }
      this.mouths.forEach((g,index)=>{
        const side=index===0?1:-1,a=g.attributes.position;
        a.setXYZ(j*2,x,0,0);a.setXYZ(j*2+1,x,side*rad*Math.sin(angle),rad*Math.cos(angle));
      });
    }
    p.needsUpdate=n.needsUpdate=true;
    this.skin.computeBoundingSphere();
    this.mouths.forEach(g=>{g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();});
  }
}
