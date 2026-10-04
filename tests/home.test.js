import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlacement,applyLayout,homeRoute } from '../src/game/HomeLayout.js';
import { advanceCrops,serviceCrops } from '../src/game/FarmState.js';
import { CompanionPlay,rewardCompanionPlay } from '../src/game/CompanionPlay.js';
const room = { width:640,height:448,flooded:false,fixed:[],door:{x:240,y:360,w:160,h:88},essentials:[{x:80,y:120}] };
const items = [{id:'chair',x:100,y:220,w:48,h:24,drawW:56,drawH:70},{id:'sofa',x:200,y:220,w:70,h:24,drawW:100,drawH:50}];
test('placement rejects doorway, overlaps and dry furnishings under water', () => {
  assert.match(validatePlacement(room,items,{},'chair',{x:320,y:400}),/doorway/);
  assert.match(validatePlacement(room,items,{},'chair',{x:200,y:220}),/overlaps/);
  assert.match(validatePlacement({...room,flooded:true},items,{},'chair',{x:320,y:220}),/dry cabin/);
  assert.equal(validatePlacement(room,items,{},'chair',{x:320,y:220}),'');
});
test('furniture cannot cut off access to an essential', () => {
  const barrier = {id:'barrier',x:320,y:220,w:608,h:24,drawW:608,drawH:24};
  assert.match(validatePlacement(room,[barrier],{},'barrier',{x:320,y:220}),/walking path/);
});
test('stored furnishings remain owned and layout application keeps essentials', () => {
  const data = {isHomeCabin:true,isFlooded:true,decorations:[{homeId:'starter-1',x:100,y:120},{type:'workbench',x:540,y:392}],rugs:[]};
  applyLayout(data,{'starter-1':null,'decor-plant':{x:320,y:256},'decor-sofa':{x:160,y:200}},['plant','sofa']);
  assert.equal(data.decorations.length,2); assert.equal(data.decorations[0].type,'workbench'); assert.equal(data.decorations[1].piece,'plant_tall');
});
test('crop days and helper work apply identically to off-screen snapshots, once a day', () => {
  const plots = ['home-0-1','home-0-0'].map(id => ({id,crop:'sproutroot',stage:0,watered:true}));
  advanceCrops(plots); assert.deepEqual(plots.map(p => p.stage),[1,1]);
  const opts = {day:2,servicedDay:0,turtleCove:true,sprinkler:false};
  const servicedDay = serviceCrops(plots,opts); assert.equal(plots[1].watered,true); assert.equal(plots[0].watered,false);
  serviceCrops(plots,{...opts,servicedDay}); assert.equal(plots[0].watered,false);
  serviceCrops(plots,{...opts,day:3,sprinkler:true}); assert.ok(plots.every(p => p.watered));
});
test('companion play success and cancellation do not permit repeated daily rewards', () => {
  const game = new CompanionPlay('puppy');
  for (let i=0;i<3;i++) { game.phase=.5; game.animate=0; game.onAction(); }
  assert.equal(game.result,'success'); const pet = {happiness:50,hunger:60,lastPlayRewardDay:0};
  assert.equal(rewardCompanionPlay(pet,2,'cancelled'),false);
  assert.equal(rewardCompanionPlay(pet,2,game.result),true); assert.equal(pet.happiness,75); assert.equal(pet.hunger,56);
  assert.equal(rewardCompanionPlay(pet,2,game.result),false);
  assert.equal(rewardCompanionPlay(pet,3,game.result),true);
  const timeout = new CompanionPlay('kitten'); timeout.update(21); assert.equal(timeout.result,'timeout');
});
test('home companion paths go around furniture instead of passing through it', () => {
  const obstacle={x:200,y:180,w:120,h:80}, world={width:640,height:448,colliders:[obstacle]};
  const path=homeRoute(world,{x:120,y:220},{x:400,y:220});
  assert.ok(path.length>10); assert.ok(Math.abs(path.at(-1).x-400)<16);
  assert.ok(path.every(p=>!(p.x>190&&p.x<330&&p.y>170&&p.y<270)));
});
