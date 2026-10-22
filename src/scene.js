import * as THREE from 'three';
import { CELL, SIZE, random, key, walkable, distance } from './maze.js';
import { WeaponView } from './weapon-view.js';
import { PacmanBody } from './pacman-body.js';
import { traceShot } from './weapon.js';
const TAU = Math.PI * 2;
const v3 = (x,y,z) => new THREE.Vector3(x,y,z);

function concrete(seed, floor = false) {
  const rng = random(seed), canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d'); c.fillStyle = floor ? '#414846' : '#777b70'; c.fillRect(0,0,256,256);
  for (let i=0;i<14000;i++) {
    const value = Math.floor(rng()*120); c.fillStyle = `rgba(${value},${value},${value*.91},${rng()*.25})`;
    c.fillRect(rng()*256,rng()*256,1+rng()*3,1+rng()*3);
  }
  for (let i=0;i<60;i++) {
    const x=rng()*256, y=rng()*256, r=8+rng()*52, g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0, i%5 ? '#17292135' : '#45231860'); g.addColorStop(1,'#00000000'); c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
  c.strokeStyle='#161e1c66'; c.lineWidth=.8;
  for(let i=0;i<12;i++){ let x=rng()*256,y=rng()*256;c.beginPath();c.moveTo(x,y);for(let j=0;j<6;j++){x+=(rng()-.5)*24;y+=rng()*17;c.lineTo(x,y);}c.stroke(); }
  c.strokeStyle='#0c151777';c.strokeRect(0,0,256,256);
  if(!floor){c.fillStyle='#24322d55';c.fillRect(0,163,256,60);c.fillStyle='#111d1744';c.fillRect(0,160,256,3);}
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.anisotropy=4; return texture;
}
function signTexture(title, sub, color='#c3c5a7') {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192; const c=canvas.getContext('2d');
  c.fillStyle='#17201e';c.fillRect(0,0,512,192);c.strokeStyle=color;c.lineWidth=6;c.strokeRect(8,8,496,176);
  c.fillStyle=color;c.textAlign='center';c.font='bold 47px monospace';c.fillText(title,256,89);c.font='20px monospace';c.fillText(sub,256,139);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export class World {
  constructor(canvas, game, settings) {
    this.canvas=canvas;this.game=game;this.settings=settings;this.elapsed=0;this.yaw=Math.PI;this.pitch=.05;this.pointer=false;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#101816');this.scene.fog=new THREE.FogExp2('#101816',.038);
    this.camera=new THREE.PerspectiveCamera(66,1,.08,95);this.camera.position.set(6.4,2.5,2.7);
    this.textures=[];this.dummy=new THREE.Object3D();this.rng=random(889);this.lights=[];this.lightPlaces=[];
    this.wallMaterial=new THREE.MeshStandardMaterial({map:concrete(3),roughness:.97,color:0xb6b9a8});
    this.floorMaterial=new THREE.MeshStandardMaterial({map:concrete(8,true),roughness:.75,metalness:.16});
    this.textures.push(this.wallMaterial.map,this.floorMaterial.map);
    this.rust=new THREE.MeshStandardMaterial({color:0x514039,roughness:.91,metalness:.55});
    this.dark=new THREE.MeshStandardMaterial({color:0x111a18,roughness:.72,metalness:.6});
    this.buildMaze();this.buildPlayer();this.buildEnemies();this.buildItems();this.buildDetails();
    this.weaponView=new WeaponView(this.scene);
    this.scene.add(new THREE.HemisphereLight(0x9bb1a0,0x171715,1.0));
    this.flashlight=new THREE.SpotLight(0xd2e0c2,29,24,Math.PI/4.4,.6,1.2);this.flashlight.castShadow=true;
    this.flashlight.shadow.mapSize.set(512,512);this.flashlight.shadow.bias=-.001;this.scene.add(this.flashlight,this.flashlight.target);
    this.fill=new THREE.PointLight(0x93bcb0,4.2,8,1.6);this.scene.add(this.fill);
    for(let i=0;i<6;i++){const light=new THREE.PointLight(0xa1c9af,8,10,1.4);this.lights.push(light);this.scene.add(light);}
    this.applySettings(settings);this.resize=()=>{this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();};
    window.addEventListener('resize',this.resize);this.resize();this.syncItems(true);
  }
  mesh(geo,mat,parent=this.scene){const mesh=new THREE.Mesh(geo,mat);parent.add(mesh);return mesh;}
  box(x,y,z,w,h,d,mat,parent=this.scene){const mesh=this.mesh(new THREE.BoxGeometry(w,h,d),mat,parent);mesh.position.set(x,y,z);return mesh;}
  buildMaze(){
    const {grid,cells}=this.game.maze;
    let walls=0;grid.forEach(row=>row.forEach(v=>walls+=v));
    this.walls=new THREE.InstancedMesh(new THREE.BoxGeometry(CELL,3.15,CELL),this.wallMaterial,walls);
    let index=0;grid.forEach((row,z)=>row.forEach((v,x)=>{if(v){this.dummy.position.set(x*CELL,1.575,z*CELL);this.dummy.updateMatrix();this.walls.setMatrixAt(index++,this.dummy.matrix);}}));
    this.walls.castShadow=true;this.walls.receiveShadow=true;this.scene.add(this.walls);
    const floor=new THREE.InstancedMesh(new THREE.BoxGeometry(CELL,.14,CELL),this.floorMaterial,cells.length);
    cells.forEach((p,i)=>{this.dummy.position.set(p.x*CELL,-.09,p.z*CELL);this.dummy.updateMatrix();floor.setMatrixAt(i,this.dummy.matrix);});floor.receiveShadow=true;this.scene.add(floor);
    const ceiling=this.box((SIZE-1)*CELL/2,3.35,(SIZE-1)*CELL/2,SIZE*CELL,.25,SIZE*CELL,this.dark);ceiling.receiveShadow=true;
    const stripMat=new THREE.MeshStandardMaterial({color:0xc1ccb0,emissive:0x94bf9d,emissiveIntensity:2.4});
    const emergency=new THREE.MeshStandardMaterial({color:0x9d261c,emissive:0xeb2d13,emissiveIntensity:2.3});
    this.fixtures=[];
    cells.filter(p=>(p.x+p.z)%5===0).forEach((p,i)=>{
      const red=i%4===0;this.box(p.x*CELL,3.14,p.z*CELL,1.5,.16,.37,this.dark);
      const fixture=this.box(p.x*CELL,3.035,p.z*CELL,1.18,.035,.16,red?emergency:stripMat);
      this.fixtures.push(fixture);this.lightPlaces.push({x:p.x*CELL,z:p.z*CELL,red,seed:i});
    });
    // Continuous exposed overhead pipes, utility brackets and occasional broken service panels.
    const pipeGeo=new THREE.CylinderGeometry(.055,.055,CELL,7), pipePositions=[];
    cells.forEach(p=>{if(walkable(this.game.maze,p.x,p.z+1))pipePositions.push(p);});
    const pipes=new THREE.InstancedMesh(pipeGeo,this.rust,pipePositions.length);
    pipePositions.forEach((p,i)=>{this.dummy.position.set(p.x*CELL-.96,2.88,p.z*CELL+CELL/2);this.dummy.rotation.set(Math.PI/2,0,0);this.dummy.updateMatrix();pipes.setMatrixAt(i,this.dummy.matrix);});this.scene.add(pipes);this.dummy.rotation.set(0,0,0);
  }
  buildPlayer(){
    this.player=new THREE.Group();this.scene.add(this.player);this.face=new THREE.Group();this.player.add(this.face);
    const skinTexture=concrete(51);this.textures.push(skinTexture);
    const skin=new THREE.MeshStandardMaterial({map:skinTexture,color:0xc9bd86,roughness:.88,metalness:.08});
    this.jawTop=new THREE.Group();this.jawBottom=new THREE.Group();this.face.add(this.jawTop,this.jawBottom);
    this.pacmanBody=new PacmanBody(.67);
    this.mesh(this.pacmanBody.skin,skin,this.face).castShadow=true;
    const mouth=new THREE.MeshStandardMaterial({color:0x110e0c,side:THREE.DoubleSide,roughness:.9});
    this.pacmanBody.mouths.forEach(geometry=>this.mesh(geometry,mouth,this.face));
    const throat=new THREE.MeshStandardMaterial({color:0x271a0a,emissive:0x9e4917,emissiveIntensity:1.3});
    this.mesh(new THREE.SphereGeometry(.29,16,12),throat,this.face);
    const eyeMat=new THREE.MeshStandardMaterial({color:0x040706,roughness:.18});const pupil=new THREE.MeshBasicMaterial({color:0xe4e9c8});
    for(const x of [-.24,.24]){
      const eye=this.mesh(new THREE.SphereGeometry(.095,14,10),eyeMat,this.jawTop);eye.position.set(x,.32,.51);eye.scale.set(.8,1.5,.5);
      const dot=this.mesh(new THREE.SphereGeometry(.026,8,8),pupil,this.jawTop);dot.position.set(x,.33,.553);
      for(let i=0;i<3;i++){const tooth=this.mesh(new THREE.ConeGeometry(.037,.13,5),skin,this.jawTop);tooth.position.set(x+i*.045,.005,.49);tooth.rotation.z=Math.PI;}
    }
    const haloMat=new THREE.MeshBasicMaterial({color:0xadc8a0,transparent:true,opacity:.1,depthWrite:false});
    this.trail=[];for(let i=0;i<5;i++){const p=this.mesh(new THREE.SphereGeometry(.06,7,7),haloMat);this.trail.push(p);}
  }
  buildEnemies(){
    this.enemyModels=this.game.enemies.map((e,i)=>{
      const g=new THREE.Group();this.scene.add(g);const cloth=new THREE.MeshStandardMaterial({color:[0x505b53,0x978e78,0x292f2c,0x472622][i],roughness:1,side:THREE.DoubleSide});
      const bone=new THREE.MeshStandardMaterial({color:0xb1ac94,roughness:.9});const black=new THREE.MeshBasicMaterial({color:0x020504});
      const glow=new THREE.MeshBasicMaterial({color:[0xccd5b2,0xe5c5ae,0xd45737,0xe46542][i]});
      const geo=new THREE.ConeGeometry(i===3?.28:.47,i===3?1.15:1.48,18,6,true);
      const pos=geo.attributes.position;for(let j=0;j<pos.count;j++){if(pos.getY(j)<-.5)pos.setY(j,pos.getY(j)+.13*Math.sin(j*2.7));}geo.computeVertexNormals();
      const robe=this.mesh(geo,cloth,g);robe.position.y=.83;
      const head=this.mesh(new THREE.SphereGeometry(i===2?.3:.25,20,16),bone,g);head.position.y=1.65;head.scale.set(1,i===1?1.45:1.16,.83);
      const mouth=this.mesh(new THREE.SphereGeometry(.11,12,12),black,g);mouth.position.set(0,1.54,.205);mouth.scale.set(.65,i===1?2.25:1.2,.25);
      for(const x of [-.09,.09]){
        const socket=this.mesh(new THREE.SphereGeometry(.08,12,10),black,g);socket.position.set(x,1.73,.205);
        const eye=this.mesh(new THREE.SphereGeometry(.026,8,8),glow,g);eye.position.set(x,1.73,.267);
      }
      const arms=[];for(const s of [-1,1]){
        const arm=new THREE.Group();arm.position.set(s*.26,1.37,0);g.add(arm);arm.rotation.z=s*.21;
        const limb=this.mesh(new THREE.CylinderGeometry(.04,.022,i===3?1.3:.85,6),cloth,arm);limb.position.y=-.43;
        const hand=this.mesh(new THREE.ConeGeometry(.095,.29,4),bone,arm);hand.position.y=-.92;hand.rotation.z=Math.PI;arms.push(arm);
      }
      if(i===2){const crown=this.mesh(new THREE.TorusGeometry(.46,.016,6,40),glow,g);crown.position.y=1.77;crown.rotation.x=Math.PI/2;
        for(let n=0;n<5;n++){const spike=this.mesh(new THREE.ConeGeometry(.026,.5,4),bone,g);spike.position.set(Math.cos(n/5*TAU)*.3,1.98,Math.sin(n/5*TAU)*.3);}}
      if(i===3){for(const s of [-1,1]){const leg=this.mesh(new THREE.CylinderGeometry(.055,.022,.8,6),bone,g);leg.position.set(s*.25,.35,.1);leg.rotation.z=s*.3;}g.scale.set(1,1.17,1);}
      return {group:g,arms,cloth,head};
    });
  }
  buildItems(){
    this.orbMaterial=new THREE.MeshBasicMaterial({color:0xc8dbb3});
    this.orbs=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.10,1),this.orbMaterial,this.game.total);this.scene.add(this.orbs);
    this.soulModels=this.game.maze.souls.map(p=>{
      const g=new THREE.Group();g.position.set(p.x*CELL,.9,p.z*CELL);this.scene.add(g);
      const material=new THREE.MeshStandardMaterial({color:0xafdddd,emissive:0x73bbac,emissiveIntensity:2.3,wireframe:true});
      this.mesh(new THREE.IcosahedronGeometry(.36,1),material,g);const ring=this.mesh(new THREE.TorusGeometry(.48,.017,6,32),material,g);ring.rotation.x=Math.PI/2;
      return {group:g,id:key(p.x,p.z)};
    });
    const {exit,refuge,switch:sw}=this.game.maze;
    this.exitGroup=new THREE.Group();this.exitGroup.position.set(exit.x*CELL,0,exit.z*CELL+.6);this.scene.add(this.exitGroup);
    const gateMat=new THREE.MeshStandardMaterial({color:0x9b4434,emissive:0x55150c,emissiveIntensity:1});this.gateMat=gateMat;
    for(const x of [-1,1])this.box(x,1.4,0,.14,2.8,.18,gateMat,this.exitGroup);
    this.box(0,2.77,0,2.12,.14,.18,gateMat,this.exitGroup);this.gateBars=new THREE.Group();this.exitGroup.add(this.gateBars);
    for(let i=-4;i<=4;i++)this.box(i*.23,1.3,0,.055,2.6,.07,this.rust,this.gateBars);
    this.sign('EXIT / 17','ALL SOULS REQUIRED',v3(exit.x*CELL,2.55,exit.z*CELL+.58),0,.95);
    const safeMat=new THREE.MeshBasicMaterial({color:0x78b6a6,transparent:true,opacity:.55,side:THREE.DoubleSide});
    this.safeRing=this.mesh(new THREE.RingGeometry(1.5,1.56,64),safeMat);this.safeRing.rotation.x=-Math.PI/2;this.safeRing.position.set(refuge.x*CELL,.01,refuge.z*CELL);
    this.switchGroup=new THREE.Group();this.switchGroup.position.set(sw.x*CELL,0,sw.z*CELL);this.scene.add(this.switchGroup);
    this.box(0,.62,0,.55,1.24,.48,this.dark,this.switchGroup);this.box(0,1.32,0,.8,.18,.7,this.rust,this.switchGroup);
    const switchMat=new THREE.MeshStandardMaterial({color:0xaa321f,emissive:0xa9220d,emissiveIntensity:1.8});
    this.box(0,1.43,0,.28,.07,.22,switchMat,this.switchGroup);this.sign('POWER','E / EMERGENCY',v3(sw.x*CELL,1,sw.z*CELL+.253),0,.36);
  }
  sign(title,sub,pos,rotation=0,scale=1){const texture=signTexture(title,sub);this.textures.push(texture);const mat=new THREE.MeshStandardMaterial({map:texture,roughness:.9,emissive:0x707f68,emissiveMap:texture,emissiveIntensity:.35,side:THREE.DoubleSide});const m=this.mesh(new THREE.PlaneGeometry(2.5*scale,.94*scale),mat);m.position.copy(pos);m.rotation.y=rotation;return m;}
  buildDetails(){
    this.sign('WARD 01','NO ONE IS COMING',v3(1.64,1.95,8),Math.PI/2,1);
    this.sign('REFUGE','6 SECONDS / KEEP MOVING',v3(6.4,2.1,1.64),0,.8);
    const scratchMat=new THREE.MeshBasicMaterial({color:0x36251e,transparent:true,opacity:.7});
    const debrisGeo=new THREE.TetrahedronGeometry(.15);const debris=[];
    for(const p of this.game.maze.cells){
      if(this.rng()<.37)debris.push(p);
      if(this.rng()<.06 && !walkable(this.game.maze,p.x-1,p.z)){
        this.sign('CAUTION','SUB-LEVEL / RESTRICTED',v3(p.x*CELL-1.585,1.8,p.z*CELL),Math.PI/2,.62);
        // Fine white webs in the top corners of neglected service corridors.
        const pts=[];for(let j=0;j<7;j++){pts.push(p.x*CELL-1.55,3.12,p.z*CELL-.6,p.x*CELL-1.55+j*.1,2.45+j*.1,p.z*CELL+.1);}
        const web=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pts,3)),new THREE.LineBasicMaterial({color:0xa1a997,transparent:true,opacity:.15}));this.scene.add(web);
      }
      if(this.rng()<.09){const stain=this.mesh(new THREE.CircleGeometry(.35+this.rng()*.4,9),scratchMat);stain.rotation.x=-Math.PI/2;stain.position.set(p.x*CELL+.7,.003,p.z*CELL);stain.scale.y=1.8;}
    }
    const rubble=new THREE.InstancedMesh(debrisGeo,this.rust,debris.length*3);
    debris.forEach((p,i)=>{for(let j=0;j<3;j++){this.dummy.position.set(p.x*CELL+1.1+this.rng()*.2,.06,p.z*CELL+(this.rng()-.5)*2);this.dummy.rotation.set(this.rng(),this.rng(),this.rng());this.dummy.updateMatrix();rubble.setMatrixAt(i*3+j,this.dummy.matrix);}});this.scene.add(rubble);this.dummy.rotation.set(0,0,0);
    // An abandoned gurney against the start-room wall; non-blocking visual set dressing.
    const equipment=new THREE.Group();equipment.position.set(9.95,0,6.4);this.scene.add(equipment);
    this.box(0,.68,0,.65,.12,1.8,this.rust,equipment);this.box(0,.79,0,.58,.1,1.65,this.wallMaterial,equipment);
    for(const x of [-.24,.24])for(const z of [-.65,.65]){this.box(x,.35,z,.06,.7,.06,this.rust,equipment);const wheel=this.mesh(new THREE.TorusGeometry(.10,.03,6,12),this.dark,equipment);wheel.position.set(x,.12,z);wheel.rotation.y=Math.PI/2;}
    const coords=[];for(let i=0;i<550;i++)coords.push(this.rng()*SIZE*CELL,this.rng()*2.9,this.rng()*SIZE*CELL);
    this.dust=this.scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(coords,3)),new THREE.PointsMaterial({color:0xc4d0b9,size:.024,transparent:true,opacity:.4,depthWrite:false}))).children.at(-1);
    const sparks=[];for(let i=0;i<14;i++)sparks.push((this.rng()-.5)*.5,this.rng(),(this.rng()-.5)*.5);
    this.sparkPoints=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(sparks,3)),new THREE.PointsMaterial({color:0xffb875,size:.043}));this.scene.add(this.sparkPoints);
  }
  syncItems(force=false){
    if(!force && this.lastOrbs===this.game.orbs.size)return;this.lastOrbs=this.game.orbs.size;
    let i=0;for(const id of this.game.orbs){const [x,z]=id.split(',').map(Number);this.dummy.position.set(x*CELL,.64,z*CELL);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.orbs.setMatrixAt(i++,this.dummy.matrix);}
    this.orbs.count=i;this.orbs.instanceMatrix.needsUpdate=true;
  }
  applySettings(settings){this.settings=settings;const q=settings.quality;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='high'?1.75:q==='medium'?1.25:1));this.renderer.shadowMap.enabled=q==='high';this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
  look(dx,dy){this.yaw-=dx*this.settings.sensitivity*.002;this.pitch=THREE.MathUtils.clamp(this.pitch+dy*this.settings.sensitivity*.001,-.3,.35);}
  fireWeapon() {
    if (!this.game.weaponUnlocked || this.game.phase!=='playing') return null;
    this.update(0);
    const aim=this.weaponAim();
    return this.game.shoot(aim.origin,aim.direction);
  }
  weaponAim() {
    const game=this.game,eye=v3(game.player.x*CELL,1.45,game.player.z*CELL);
    const viewDirection=this.camera.getWorldDirection(new THREE.Vector3());
    const target=traceShot(game.maze,game.enemies,this.camera.position,viewDirection);
    const point=new THREE.Vector3().copy(target.point);
    if(this.firstPerson)return {origin:eye,direction:viewDirection,point};
    // Camera ray selects the reticle point. The real shot starts at the weapon,
    // not at the remote camera. Check the eye-to-muzzle segment too: a barrel
    // touching/entering a wall must not let a bullet spawn on its other side.
    const origin=this.weaponView.worldMuzzle();
    const reach=origin.clone().sub(eye),wall=traceShot(game.maze,[],eye,reach);
    if(wall&&wall.kind==='wall'&&wall.distance<=reach.length())return {origin:eye,direction:reach.normalize(),point};
    const direction=point.clone().sub(origin).normalize();
    return {origin,direction,point};
  }
  update(dt){
    this.elapsed+=dt;
    const game=this.game,t=this.settings.reducedMotion?0:this.elapsed,p=game.player,isMenu=game.phase==='menu';this.syncItems();
    this.player.position.set(p.x*CELL,.89+Math.sin(t*3)*.045,p.z*CELL);
    const facing=game.weaponUnlocked?this.yaw+Math.PI:Math.atan2(p.dx,p.dz);this.face.rotation.y+=Math.atan2(Math.sin(facing-this.face.rotation.y),Math.cos(facing-this.face.rotation.y))*Math.min(1,dt*12);
    const bite=(Math.sin(t*(p.moving?15:3))*.5+.5)*(p.moving?.42:.11)+.06;
    this.pacmanBody.update(bite);this.jawTop.rotation.x=-bite;this.jawBottom.rotation.x=bite;
    this.player.visible=true;
    this.trail.forEach((m,i)=>{m.position.set(p.x*CELL-p.dx*(i+1)*.23,.65+Math.sin(t*3+i)*.08,p.z*CELL-p.dz*(i+1)*.23);m.visible=p.moving;});
    this.enemyModels.forEach((m,i)=>{
      const e=game.enemies[i],death=e.dead?Math.min(1,(game.time-e.deathAt)/1.2):0;
      m.group.position.set(e.x*CELL,.06+Math.sin(t*(i===1?5:2)+i)*.08+death*.7,e.z*CELL);
      m.group.rotation.y=Math.atan2(p.x-e.x,p.z-e.z);
      m.group.rotation.z=e.hitFlash>0&&!this.settings.reducedMotion?Math.sin(e.hitFlash*32)*.10:0;
      m.group.scale.set(1-death*.8,(i===3?1.17:1)*(1+death*.5),1-death*.8);
      m.arms.forEach((a,j)=>a.rotation.x=Math.sin(t*3+j*3)*.12);
      m.group.visible=e.dead?death<1:e.stun<=0 || this.settings.reducedMotion || Math.sin(t*14)>.4;
      m.group.traverse(o=>{if(o.material){o.material.transparent=e.dead;o.material.opacity=1-death;o.material.depthWrite=!e.dead;}});
      m.cloth.emissive.set(e.dead?0x55997a:e.hitFlash>0?0x778866:game.ward>0?0x174938:0x000000);
    });
    this.soulModels.forEach(m=>{m.group.visible=game.souls.has(m.id);m.group.rotation.y=t*.65;m.group.position.y=.83+Math.sin(t*2)*.13;});
    this.orbs.position.y=Math.sin(t*2)*.045;
    this.gateMat.emissive.set(game.orbs.size?0x55150c:0x3cbe82);this.gateBars.position.y=game.orbs.size?0:2.8;
    this.safeRing.material.opacity=game.safeBudget>0?.38+Math.sin(t*2)*.12:.05;
    let target=v3(p.x*CELL,1.25,p.z*CELL),desired;
    if(isMenu){target=v3(5.5,1.25,8.3);desired=v3(9.6+Math.sin(t*.15)*.4,1.8,3.45);this.player.visible=true;}
    else {
      const backward=v3(Math.sin(this.yaw),0,Math.cos(this.yaw));
      desired=target.clone().addScaledVector(backward,3.8);desired.y=2.25+this.pitch*2;
      // Collision avoidance against the exact wall bounds; shorten the boom before contact.
      const direction=desired.clone().sub(target);const length=direction.length();direction.normalize();
      this.cameraRay ||= new THREE.Raycaster();this.cameraRay.set(target,direction);this.cameraRay.far=length+.2;
      const hit=this.cameraRay.intersectObject(this.walls,false)[0];if(hit)desired=target.clone().addScaledVector(direction,Math.max(.32,hit.distance-.22));
      // Snap inward; damp only where the interpolation segment is clear of walls.
      if(hit || this.lastPhase!==game.phase || distance(this.camera.position,{x:desired.x,z:desired.z})>10)this.camera.position.copy(desired);
    }
    this.camera.position.lerp(desired,1-Math.exp(-dt*14));
    // Check the smoothed camera's line of sight too, so a corner cannot clip the boom.
    if(!isMenu){const direction=this.camera.position.clone().sub(target);const len=direction.length();this.cameraRay.set(target,direction.normalize());this.cameraRay.far=len+.18;const h=this.cameraRay.intersectObject(this.walls,false)[0];if(h)this.camera.position.copy(target.clone().addScaledVector(direction,Math.max(.25,h.distance-.18)));}
    if(this.settings.shake && !this.settings.reducedMotion && game.captureFlash>0){this.camera.position.x+=Math.sin(t*90)*.07*game.captureFlash;this.camera.position.y+=Math.cos(t*74)*.04*game.captureFlash;}
    const forward=v3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    const boom=this.camera.position.distanceTo(target);
    // Decide the fallback from the collision-resolved destination, not the old
    // first-person camera position; otherwise V can get stuck in first person.
    this.firstPerson=!isMenu && desired.distanceTo(target)<1.75;
    // Hide the character while the boom extends out of their body after V.
    this.player.visible=!this.firstPerson && (isMenu || boom>=1.75);
    const lookTarget=target.clone();
    if(!isMenu)lookTarget.addScaledVector(forward,Math.max(0,1-(boom-.5)/2)*4);
    if(game.weaponUnlocked&&!isMenu&&(this.settings.weaponPerspective==='first'||this.firstPerson)) {
      this.firstPerson=true;this.player.visible=false;
      this.camera.position.set(p.x*CELL,1.45,p.z*CELL);
      lookTarget.copy(this.camera.position).add(new THREE.Vector3(forward.x,-Math.tan(this.pitch),forward.z));
      if(this.settings.shake&&!this.settings.reducedMotion&&game.shotFlash>0)lookTarget.y+=Math.sin(game.shotFlash*60)*game.shotFlash*.04;
    } else if(game.weaponUnlocked&&!isMenu) {
      // Preserve the wall-colliding follow boom. Look past the player rather
      // than directly at their back, keeping the reticle usable for aiming.
      lookTarget.set(p.x*CELL,1.45,p.z*CELL).addScaledVector(forward,8);
      lookTarget.y-=Math.tan(this.pitch)*8;
    }
    this.camera.lookAt(lookTarget);this.lastPhase=game.phase;
    this.flashlight.position.copy(this.camera.position);
    this.flashlight.target.position.copy(target).addScaledVector(isMenu?v3(0,0,1):forward,6);this.flashlight.target.position.y=.8;
    this.flashlight.intensity=game.blackout>0?16:29;this.fill.position.copy(target);this.fill.intensity=game.blackout>0?2.7:4.2;
    const nearest=[...this.lightPlaces].sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z));
    this.lights.forEach((l,i)=>{const pos=nearest[i];l.position.set(pos.x,2.86,pos.z);l.color.set(pos.red?0xe8522b:0xb7d9bc);const flicker=!this.settings.reducedMotion && Math.sin(t*17+pos.seed)*Math.sin(t*2.7+pos.seed*3)>.57?.17:1;l.intensity=game.blackout>0?(pos.red?.7:0):(pos.red?4.5:8)*flicker;});
    this.fixtures.forEach((f,i)=>f.visible=game.blackout<=0 || i%4===0);
    const spark=nearest[0];this.sparkPoints.position.set(spark.x,2.2-(t%1)*.7,spark.z);this.sparkPoints.visible=Math.sin(t*3.1)>.985;
    this.dust.rotation.y=Math.sin(t*.03)*.007;
    this.scene.fog.density=game.blackout>0?.068:.038;
    this.weaponView.update(game,this.settings,this.camera.aspect);
    const aimPoint=game.weaponUnlocked?traceShot(game.maze,game.enemies,this.camera.position,this.camera.getWorldDirection(new THREE.Vector3())).point:null;
    this.weaponView.placeWorld(game,this.firstPerson,this.yaw,aimPoint);
    this.renderer.render(this.scene,this.camera);
    this.weaponView.render(this.renderer,game);
  }
  dispose(){window.removeEventListener('resize',this.resize);this.weaponView.dispose();const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.renderer.dispose();}
}
