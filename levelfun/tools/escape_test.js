// Automated full-run check (Playwright): boots new random games and escapes both ways. Usage: node escape_test.js <runs> [exit|elevator|both]  (needs the game served on localhost:8123)
const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const c=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});
const boot=async()=>{ await p.goto('http://localhost:8123/levelfun/index.html?touch=1&difficulty=practice'); await p.evaluate(()=>localStorage.clear()); await p.goto('http://localhost:8123/levelfun/index.html?touch=1&difficulty=practice'); await p.waitForFunction(()=>document.getElementById('primary').textContent==='START'&&window.LF,{timeout:90000}); await p.tap('#primary'); await p.waitForTimeout(300); };
const log=[]; const L=(s)=>{ log.push(s); if(!s.startsWith('OK')) console.log(s); };
const run = async (route) => {
  await boot();
  const res = await p.evaluate(async (route)=>{
    const {items,uses,player,world,input}=LF; const out=[]; player.wakeT=99;
    const tick=(s)=>{ for(let i=0;i<Math.round(s*30);i++){ player.update(1/30); items.update(1/30,player); uses.update(1/30); world.update(1/30);} };
    const aimAt=(x,y,z,fromX,fromZ,lvl)=>{ player.teleport({x:fromX,z:fromZ,y:lvl}); player.wakeT=99; const dx=x-fromX,dz=z-fromZ,dy=y-(lvl+1.6); player.yaw=Math.atan2(-dx,-dz); player.pitch=Math.atan2(dy,Math.hypot(dx,dz)); player.update(0.001); };
    const free=(x,z,lvl)=>{ for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]]) for (const d of [1.0,1.3,0.8]) { const sx=x+dx*d, sz=z+dz*d; if(!world.collision.overlaps(sx,sz,0.3,lvl+0.2,lvl+1.7) && world.floorAt(sx,sz,lvl+0.1,true)!==null && Math.abs(world.floorAt(sx,sz,lvl+0.1,true)-lvl)<0.05) return [sx,sz]; } return null; };
    const get=id=>items.items.find(i=>i.id===id||i.uid===id);
    const fetch=(id)=>{ const it=get(id); if(!it||(it.state!=='world'&&it.state!=='air')) { out.push('X '+id+' not lying in the world: '+(it&&it.state)); return false; }
      const lvl=Math.round(it.y/4)*4; const f=free(it.x,it.z,lvl); if(!f){ out.push('X '+id+' no free standing spot'); return false; }
      aimAt(it.x,it.y+0.05,it.z,f[0],f[1],lvl); tick(0.3);
      if (items.held) items.drop(); input.emit('interact'); tick(0.2);
      const ok=items.heldId()===it.id; if(!ok) out.push('X could not pick up '+id); return ok; };
    const station=(sid)=>uses.stations.find(s=>s.id===sid);
    const apply=(sid,sx,sz,lvl)=>{ const s=station(sid); aimAt(s.x,s.y,s.z,sx,sz,lvl); tick(0.2); const can=uses.canUse(); input.emit('use'); tick(0.2); return can; };
    const step=(name,ok)=>out.push((ok?'OK  ':'FAIL ')+name);
    const win=async(game,machX)=>{ // pick up the token, play, win
      if(items.heldId()!=='token' && !fetch('token')) { step('token',false); return false; }
      const m=world.fixtures.arcade.find(a=>a.game===game); const scr=world.interactables.find(i=>i.kind==='arcade'&&i.game===game);
      aimAt(m.x,1.2,0.5,m.x,2.4,4); tick(0.2); const t=world.interactables.find(i=>i.kind==='arcade'&&i.game===game); LF.openArcade(game,{warn(){}}); tick(0.1);
      const cv=document.getElementById('acv'); const ok=!document.getElementById('arcade').hidden; if(ok){ cv.__lfWin(); } document.getElementById('aquit').click(); tick(3.5); return ok; };
    if (route==='exit') {
      step('token + win Find the Party', await win('find'));
      step('pick up the prize (Exit Code Note)', fetch('exit_code_note'));
      // the exit mechanisms
      let ok=fetch('exit_key')&&apply('ex_key',1.4,13.6,0); step('Exit Key -> breaker box', ok&&uses.p.exit.key);
      ok=fetch('wire_cutters')&&apply('ex_wires',1.4,14.7,0); step('Wire Cutters -> junction box', ok&&uses.p.exit.wires);
      ok=fetch('exit_fuse'); step('fetch Exit Fuse (may need the Security Room: Turning Handle)', ok);
      if(!ok){ if(fetch('turning_handle')){ apply('sec_door',54.4,14.2,0); step('Turning Handle -> Security door unlocked', !world.doors.find(d=>d.o.kind==='heavy').locked); ok=fetch('exit_fuse'); step('fetch Exit Fuse now', ok);} }
      ok=ok&&apply('ex_fuse',1.4,20.7,0); step('Exit Fuse -> fuse cabinet', uses.p.exit.fuse);
      ok=fetch('exit_code_note')&&apply('ex_code',1.4,19.5,0); step('Code Note -> keypad (green)', uses.p.exit.code);
      step('exit door opened', uses.p.exitOpen); tick(2);
      // walk out
      player.teleport({x:3,z:17,y:0}); player.wakeT=99; player.yaw=Math.PI/2; player.pitch=0;
      for(let i=0;i<120&&document.getElementById('ending').hidden;i++){ input.touchMove.x=0; input.touchMove.y=1; tick(1/30); } input.touchMove.y=0;
      step('walked through the door -> ending: '+document.getElementById('endt').textContent, !document.getElementById('ending').hidden&&document.getElementById('ending').className==='exit');
    } else {
      step('token + win Pop the Balloons', await win('pop')); step('token + win Birthday Dash', await win('dash'));
      let ok=fetch('screwdriver')&&apply('el_wiring',55.4,21.8,8); step('Screwdriver -> wiring panel', ok&&uses.p.elev.wiring);
      ok=fetch('elevator_circuit')&&apply('el_circuit',51,21.8,8); step('Circuit -> panel', ok&&uses.p.elev.circuit);
      ok=fetch('elevator_motor')&&apply('el_motor',52,19.6,8); step('Motor -> winch', ok&&uses.p.elev.motor);
      ok=fetch('generator_handle')&&apply('gen_handle',23,19.2,-4); step('Generator Handle -> generator', ok&&uses.p.genHandle);
      ok=fetch('power_fuse')&&apply('gen_fuse',25.3,19.2,-4); step('Power Fuse -> generator', ok&&uses.p.genFuse);
      ok=fetch('elevator_key')&&apply('el_door',58,11,8); step('Elevator Key -> elevator door', ok&&uses.p.elevOpen); tick(2);
      player.teleport({x:57,z:11,y:8}); player.wakeT=99; player.yaw=-Math.PI/2; player.pitch=0;
      for(let i=0;i<120&&document.getElementById('ending').hidden;i++){ input.touchMove.x=0; input.touchMove.y=1; tick(1/30); } input.touchMove.y=0;
      step('walked into the elevator -> ending: '+document.getElementById('endt').textContent, !document.getElementById('ending').hidden&&document.getElementById('ending').className==='elevator');
    }
    return out; }, route);
  res.forEach(L);
};
const N=+process.argv[2]||1, which=process.argv[3]||'both';
for(let k=0;k<N;k++){ if(which!=='elevator'){ console.log('--- EXIT run',k+1); await run('exit'); } if(which!=='exit'){ console.log('--- ELEVATOR run',k+1); await run('elevator'); } }
console.log(errs); await b.close();})();
