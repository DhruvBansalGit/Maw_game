import * as THREE from 'three';
import { CELL } from './maze.js';

// Procedural occult sidearm. A separate depth-cleared viewmodel keeps the gun
// readable at walls in first person. Third person uses a world-space copy at
// the player's side, with normal depth testing and a checked muzzle origin.
export class WeaponView {
  constructor(worldScene) {
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(66,1,.01,8);
    this.scene.add(new THREE.HemisphereLight(0xc9ddc4,0x412719,2.5));
    const light = new THREE.PointLight(0xe8c29a,7,5); light.position.set(-.5,1,0); this.scene.add(light);
    this.gun = new THREE.Group(); this.scene.add(this.gun);
    const iron = new THREE.MeshStandardMaterial({color:0x363e37,metalness:.8,roughness:.64});
    const rust = new THREE.MeshStandardMaterial({color:0x784d35,metalness:.65,roughness:.83});
    const bone = new THREE.MeshStandardMaterial({color:0xc6ba96,roughness:.8});
    const grip = new THREE.MeshStandardMaterial({color:0x241d1a,roughness:.96});
    const voidMat = new THREE.MeshBasicMaterial({color:0x060907});
    const rune = new THREE.MeshStandardMaterial({color:0x9ac5a5,emissive:0x67b999,emissiveIntensity:2});
    const mesh = (geometry,material,x,y,z,parent=this.gun) => {const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;};
    const box = (x,y,z,w,h,d,material) => mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z);
    box(0,0,-.18,.17,.16,.42,iron);
    box(0,-.18,.015,.13,.32,.16,grip).rotation.x=-.24;
    box(0,.09,-.08,.1,.05,.18,rust);
    const barrel=mesh(new THREE.CylinderGeometry(.051,.061,.56,12),iron,0,.015,-.58);barrel.rotation.x=Math.PI/2;
    for (const z of [-.36,-.61,-.83]) {const ring=mesh(new THREE.TorusGeometry(.055,.012,6,16),rust,0,.015,z);ring.rotation.z=.2;}
    mesh(new THREE.CircleGeometry(.044,16),voidMat,0,.015,-.867).rotation.y=Math.PI;
    box(0,.085,-.80,.019,.065,.025,rune); // Front sight / luminous bead.
    box(-.045,.1,-.06,.022,.045,.055,bone);box(.045,.1,-.06,.022,.045,.055,bone);
    const guard=mesh(new THREE.TorusGeometry(.072,.012,6,18),rust,0,-.14,-.15);guard.rotation.y=Math.PI/2;
    box(0,-.10,-.12,.015,.10,.022,iron).rotation.x=.3;
    for (let i=0;i<4;i++) {box(.087,0,-.30+i*.068,.012,.105,.022,bone);box(-.087,0,-.30+i*.068,.012,.105,.022,bone);}
    for (let i=0;i<3;i++) box(.071,-.16-i*.065,.045,.012,.014,.13,rust);
    // Etched cross and captive soul chamber, visible on the side of the receiver.
    box(.091,.025,-.20,.012,.07,.009,rune);box(.091,.038,-.20,.012,.009,.055,rune);
    this.flash = new THREE.Group();this.flash.position.set(0,.015,-.91);this.gun.add(this.flash);
    const fire=new THREE.MeshBasicMaterial({color:0xd9edb9,transparent:true,opacity:.9,depthWrite:false});
    const flame=mesh(new THREE.ConeGeometry(.1,.3,6),fire,0,0,-.08,this.flash);flame.rotation.x=-Math.PI/2;
    const burst=mesh(new THREE.IcosahedronGeometry(.075,0),fire,0,0,0,this.flash);burst.scale.set(1.8,1.8,.5);
    this.flash.visible=false;
    this.worldGun=this.gun.clone(true);worldScene.add(this.worldGun);this.worldGun.visible=false;
    this.worldFlash=this.worldGun.children[this.gun.children.indexOf(this.flash)];
    this.impact=this.particles(worldScene,22,0xe7c69b,.045);
    this.souls=Array.from({length:4},()=>this.particles(worldScene,44,0x9ce3c0,.065));
  }
  particles(scene,count,color,size) {
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));
    const material=new THREE.PointsMaterial({color,size,transparent:true,opacity:0,depthWrite:false});
    const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.visible=false;scene.add(points);return points;
  }
  scatter(points,age,duration,spread,up) {
    points.visible=age>=0&&age<duration;if(!points.visible)return;
    const a=points.geometry.attributes.position;
    for(let i=0;i<a.count;i++) {const angle=i*2.399963,level=(i+.5)/a.count;
      a.setXYZ(i,Math.cos(angle)*spread*age*(.4+level),up*age+(level-.5)*spread*age,Math.sin(angle)*spread*age*(.4+level));
    }
    a.needsUpdate=true;points.material.opacity=Math.max(0,1-age/duration);
  }
  update(game,settings,aspect) {
    const age=game.lastShot ? game.time-game.lastShot.at : Infinity;
    const recoil=settings.reducedMotion?0:Math.max(0,1-age/.25);
    this.gun.position.set(.27,-.25,-.46+recoil*.10);this.gun.rotation.set(recoil*.12,-.06,-.07);
    if (!settings.reducedMotion && game.player.moving) this.gun.position.y+=Math.sin(game.time*9)*.009;
    this.flash.visible=game.weaponUnlocked&&age<.075&&!settings.reducedMotion;
    if(this.camera.aspect!==aspect){this.camera.aspect=aspect;this.camera.updateProjectionMatrix();}
    if(game.lastShot && game.lastShot.kind!=='miss') {
      this.impact.position.copy(game.lastShot.point);this.impact.material.color.set(game.lastShot.kind==='enemy'?0x9ce3c0:0xe7c69b);
      this.scatter(this.impact,age,.6,.8,.25);
    } else this.impact.visible=false;
    this.souls.forEach((points,i)=>{
      const e=game.enemies[i];points.position.set(e.x*CELL,1.1,e.z*CELL);
      this.scatter(points,e.dead?game.time-e.deathAt:Infinity,1.5,1.3,.7);
    });
  }
  render(renderer,game) {
    if(!game.weaponUnlocked || this.worldGun.visible || !['playing','paused'].includes(game.phase))return;
    const auto=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(this.scene,this.camera);renderer.autoClear=auto;
  }
  placeWorld(game,firstPerson,yaw,point) {
    this.worldGun.visible=game.weaponUnlocked&&!firstPerson&&['playing','paused'].includes(game.phase);
    if(!this.worldGun.visible)return;
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    this.worldGun.position.set(game.player.x*CELL,1.28,game.player.z*CELL).addScaledVector(right,.80);
    this.worldGun.scale.setScalar(.80);
    const direction=new THREE.Vector3().copy(point).sub(this.worldGun.position).normalize();
    this.worldGun.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),direction);
    this.worldGun.rotateX(this.gun.rotation.x);
    this.worldFlash.visible=this.flash.visible;
    this.worldGun.updateMatrixWorld(true);
  }
  worldMuzzle() {return this.worldGun.localToWorld(new THREE.Vector3(0,.015,-.91));}
  dispose() {
    // Shared viewmodel resources are released once, not by both scene walks.
    this.worldGun.removeFromParent();
    const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    // World-space particle resources are owned/disposed by the main scene.
  }
}
