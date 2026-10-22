import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PacmanBody } from '../src/pacman-body.js';

test('rear skin is one fixed spherical surface throughout the mouth cycle',()=>{
 const body=new PacmanBody(),p=body.skin.attributes.position;
 body.update(.01);const closed=p.array.slice();
 for(const opening of [.06,.17,.3,.48,.55]){
  body.update(opening);
  for(let i=0;i<p.count;i++){
   assert.ok(Math.abs(Math.hypot(p.getX(i),p.getY(i),p.getZ(i))-.67)<1e-6);
   if(closed[i*3+2]<-1e-6)for(let axis=0;axis<3;axis++)assert.equal(p.array[i*3+axis],closed[i*3+axis]);
  }
  for(const mouth of body.mouths)for(let i=0;i<mouth.attributes.position.count;i++)assert.ok(mouth.attributes.position.getZ(i)>=0,'mouth must not extend behind the hinge');
 }
});
test('front lips move without crossing and skin triangles have outward winding',()=>{
 const body=new PacmanBody();body.update(.48);
 const top=body.mouths[0].attributes.position,bottom=body.mouths[1].attributes.position;
 for(let i=0;i<top.count;i++){assert.ok(top.getY(i)>=0);assert.ok(bottom.getY(i)<=0);assert.equal(top.getX(i),bottom.getX(i));}
 const p=body.skin.attributes.position,idx=body.skin.index;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(let i=0;i<idx.count;i+=3){a.fromBufferAttribute(p,idx.getX(i));b.fromBufferAttribute(p,idx.getX(i+1));c.fromBufferAttribute(p,idx.getX(i+2));const normal=b.clone().sub(a).cross(c.clone().sub(a));assert.ok(normal.dot(a)>-1e-8);}
});
