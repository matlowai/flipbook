/* Shared A/B review player.
   Attaches to every .cmp element carrying data-a/data-b/data-la/data-lb.
   Modes: flip / wipe / side-by-side. One live pair at a time (42 video
   elements once exhausted GPU0's DMA mapping space and locked the box).
   Audio: ON by default, bound to the visible side in flip.
   Call ReviewPlayer.rescan() after injecting new .cmp nodes. */
(function(){
  var units=[], mode="flip", looping=true, open=null;

  function frameOf(v){ return Math.round(v.currentTime*24); }

  function initCmp(c){
    if(c.dataset.pinit) return;
    c.dataset.pinit="1";
    var a=c.dataset.a, b=c.dataset.b;
    var pa=a.replace(/^media\//,"posters/").replace(/\.mp4$/,".jpg");
    var pb=b.replace(/^media\//,"posters/").replace(/\.mp4$/,".jpg");

    // shelf: two still frames, ZERO video elements until asked
    var shelf=document.createElement("div");
    shelf.className="shelf"; shelf.tabIndex=0; shelf.setAttribute("role","button");
    shelf.setAttribute("aria-label","Load this comparison");
    shelf.innerHTML=
      '<div class="pshell"><img loading="lazy" src="'+pa+'" alt=""><span class="tag a">A &middot; '+c.dataset.la+'</span></div>'+
      '<div class="pshell"><img loading="lazy" src="'+pb+'" alt=""><span class="tag b">B &middot; '+c.dataset.lb+'</span></div>'+
      '<span class="openbadge">Compare</span>';
    c.appendChild(shelf);

    var host=document.createElement("div");
    c.appendChild(host);

    var u={c:c,a:a,b:b,shelf:shelf,host:host,live:false,showb:false,muted:false,audioSide:"a",dur:0};
    units.push(u);

    function teardown(){
      if(!u.live) return;
      try{ u.va.pause(); u.vb.pause(); }catch(e){}
      [u.va,u.vb].forEach(function(v){ if(!v) return;
        v.removeAttribute("src"); try{ v.load(); }catch(e){} });
      host.innerHTML=""; shelf.style.display="";
      u.live=false; u.va=u.vb=null;
      if(open===u) open=null;
    }
    u.teardown=teardown;

    function build(){
      if(u.live) return;
      if(open && open!==u) open.teardown();      // hard cap: one live pair
      shelf.style.display="none";

      var stage=document.createElement("div");
      stage.className="stage "+mode;
      if(mode==="wipe") stage.style.setProperty("--w","50%");
      var A=document.createElement("div"); A.className="pane a";
      var B=document.createElement("div"); B.className="pane b";
      var va=document.createElement("video"), vb=document.createElement("video");
      [va,vb].forEach(function(v){ v.preload="none"; v.playsInline=true;
        v.loop=looping; v.muted=true; });
      va.poster=pa; vb.poster=pb; va.src=u.a; vb.src=u.b;
      A.innerHTML='<span class="tag a">A &middot; '+c.dataset.la+'</span>';
      B.innerHTML='<span class="tag b">B &middot; '+c.dataset.lb+'</span>';
      A.insertBefore(va,A.firstChild); B.insertBefore(vb,B.firstChild);
      stage.appendChild(A); stage.appendChild(B); host.appendChild(stage);

      var row=document.createElement("div"); row.className="crow";
      var play=document.createElement("button"); play.className="mini"; play.textContent="Play";
      var flip=document.createElement("button"); flip.className="mini"; flip.textContent="Show B";
      var scrub=document.createElement("input"); scrub.type="range"; scrub.className="scrub";
      scrub.min=0; scrub.max=1000; scrub.value=0; scrub.setAttribute("aria-label","scrub");
      var fnum=document.createElement("span"); fnum.className="fnum"; fnum.textContent="frame 0";
      var snd=document.createElement("button"); snd.className="mini"; snd.textContent="Sound";
      var mute=document.createElement("button"); mute.className="mini"; mute.textContent="Mute";
      var close=document.createElement("button"); close.className="mini"; close.textContent="Close";
      var wipe=document.createElement("input"); wipe.type="range"; wipe.className="wipeslider";
      wipe.min=0; wipe.max=100; wipe.value=50; wipe.setAttribute("aria-label","wipe position");
      wipe.style.display="none";
      [play,flip,wipe,scrub,fnum,snd,mute,close].forEach(function(el){ row.appendChild(el); });
      host.appendChild(row);

      u.va=va; u.vb=vb; u.stage=stage; u.flip=flip; u.play=play;
      u.scrub=scrub; u.fnum=fnum; u.wipe=wipe; u.live=true; u.showb=false;
      if(mode!=="flip") flip.style.display="none";
      if(mode==="wipe") wipe.style.display="";
      wipe.oninput=function(){ stage.style.setProperty("--w",wipe.value+"%"); };
      // drag anywhere on the stage to move the wipe line (wipe mode only)
      stage.addEventListener("pointerdown",function(ev){
        if(mode!=="wipe") return;
        stage.setPointerCapture(ev.pointerId);
        function move(e){
          var r=stage.getBoundingClientRect();
          var pct=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));
          stage.style.setProperty("--w",pct.toFixed(1)+"%");
          wipe.value=Math.round(pct);
        }
        move(ev);
        stage.onpointermove=move;
        stage.onpointerup=function(){ stage.onpointermove=null; stage.onpointerup=null; };
      });

      function sync(from,to){ if(Math.abs(from.currentTime-to.currentTime)>0.3) to.currentTime=from.currentTime; }
      u.applyAudio=function(){
        // RULE (operator 2026-08-20): audio ON by default; in flip mode it is
        // BOUND to the visible side; wipe/side keep an explicit A/B toggle.
        var side=(mode==="flip") ? (u.showb?"b":"a") : u.audioSide;
        va.muted = u.muted || side!=="a";
        vb.muted = u.muted || side!=="b";
        snd.textContent = (mode==="flip") ? "Audio: "+side.toUpperCase()+" (follows view)"
                                          : "Audio: "+side.toUpperCase();
        snd.classList.toggle("on", !u.muted);
        snd.disabled = (mode==="flip");        // in flip the side is bound to the view
        mute.textContent = u.muted ? "Unmute" : "Mute";
        mute.classList.toggle("on", u.muted);
      };
      u.setPlay=function(on){
        if(on){
          u.applyAudio();
          [va.play(), vb.play()].forEach(function(pr){
            if(pr&&pr.catch) pr.catch(function(){
              // browser refused unmuted autoplay: fall back muted, stay playing
              u.muted=true; u.applyAudio(); va.play(); vb.play();
            });
          });
          play.textContent="Pause"; play.classList.add("on");
        }
        else { va.pause(); vb.pause(); play.textContent="Play"; play.classList.remove("on"); }
      };
      play.onclick=function(){ u.setPlay(va.paused); };
      u.doFlip=function(){
        u.showb=!u.showb;
        stage.classList.toggle("showb",u.showb);
        flip.textContent=u.showb?"Show A":"Show B";
        flip.classList.toggle("on",u.showb);
        // hard resync so the newly audible side is sample-clean at the swap
        var vis=u.showb?vb:va, hid=u.showb?va:vb;
        if(Math.abs(vis.currentTime-hid.currentTime)>0.05) vis.currentTime=hid.currentTime;
        u.applyAudio(); u.ensurePlaying();
      };
      flip.onclick=u.doFlip;
      u.ensurePlaying=function(){
        // a rejected/stalled play() leaves a side paused; a later unmute is then silence.
        if(play.classList.contains("on")){
          [va,vb].forEach(function(v){
            if(v.paused){ var pr=v.play(); if(pr&&pr.catch) pr.catch(function(){}); }
          });
        }
      };
      snd.onclick=function(){                        // A/B side only (wipe / side-by-side)
        if(mode==="flip") return;                    // in flip the visible side owns the audio
        u.audioSide = (u.audioSide==="a") ? "b" : "a";
        u.muted=false;
        u.applyAudio(); u.ensurePlaying();
      };
      mute.onclick=function(){                       // mute is its own control now
        u.muted=!u.muted;
        u.applyAudio(); u.ensurePlaying();
      };
      close.onclick=teardown;
      va.addEventListener("loadedmetadata",function(){ u.dur=va.duration; });
      va.addEventListener("timeupdate",function(){
        if(!u.dur) return;
        scrub.value=Math.round(va.currentTime/u.dur*1000);
        fnum.textContent="frame "+frameOf(va);
        // no continuous B-sync: same-duration clips wrap together on loop, and
        // force-seeking B at the wrap was the only-B stutter. Flip and scrub
        // still hard-resync.
      });
      scrub.oninput=function(){
        if(!u.dur) return;
        var t=scrub.value/1000*u.dur;
        va.currentTime=t; vb.currentTime=t;
        fnum.textContent="frame "+Math.round(t*24);
      };
      open=u;
      u.setPlay(true);
      c.scrollIntoView({behavior:"smooth",block:"nearest"});
    }
    u.build=build;
    shelf.addEventListener("click",build);
    shelf.addEventListener("keydown",function(e){
      if(e.key==="Enter"||e.key===" "){ e.preventDefault(); build(); }
    });
  }
  document.querySelectorAll('.cmp').forEach(initCmp);


  function setMode(m){
    mode=m;
    ["flip","wipe","side"].forEach(function(x){
      var mb=document.getElementById("mode-"+x); if(mb) mb.classList.toggle("on",m===x);
    });
    if(open&&open.live){
      open.stage.className="stage "+m+(open.showb&&m==="flip"?" showb":"");
      open.flip.style.display=(m==="flip")?"":"none";
      open.wipe.style.display=(m==="wipe")?"":"none";
      if(m==="wipe") open.stage.style.setProperty("--w",open.wipe.value+"%");
      open.applyAudio();
    }
  }
  var _mode_flip=document.getElementById("mode-flip");
  if(_mode_flip) _mode_flip.onclick=function(){ setMode("flip"); };
  var _mode_wipe=document.getElementById("mode-wipe");
  if(_mode_wipe) _mode_wipe.onclick=function(){ setMode("wipe"); };
  var _mode_side=document.getElementById("mode-side");
  if(_mode_side) _mode_side.onclick=function(){ setMode("side"); };
  var _closeall=document.getElementById("closeall");
  if(_closeall) _closeall.onclick=function(){ if(open) open.teardown(); };

  // ---- filter: tags are derived from each pair, so adding rows needs no markup
  function tagsOf(c){
    var t=[], title=(c.querySelector(".ctitle")||{}).textContent||"";
    if(c.querySelector(".lbadge")) t.push("listen");
    var sec=c.closest("section"), h=sec&&sec.querySelector(".gate");
    if(h){ var m=h.textContent.match(/Gate\s*(\d)/); if(m) t.push("gate"+m[1]); }
    if(/^\s*COMPOSED/.test(title)) t.push("composed");   // not the R2 row, whose title also says "composed"
    if(/kvfp4s/i.test(title)) t.push("kvfp4s");
    if(/easycache/i.test(title)) t.push("easycache");
    if(/spectrum/i.test(title)) t.push("spectrum");
    return t;
  }
  var filt=document.getElementById("filt"), fcount=document.getElementById("fcount");
  function applyFilter(){
    if(!filt) return;                      // pages without a filter bar (weights.html)
    var want=filt.value, shown=0;
    document.querySelectorAll(".cmp").forEach(function(c){
      var on = want==="all" || tagsOf(c).indexOf(want)>=0;
      c.classList.toggle("fhide",!on);
      if(on) shown++;
      // a filtered-out pair must not keep decoding video
      if(!on && open && open.c===c) open.teardown();
    });
    // hide a section whose pairs are all filtered out, prose and all
    document.querySelectorAll("section").forEach(function(sec){
      var any=sec.querySelector(".cmp:not(.fhide)");
      sec.classList.toggle("fhide",!any);
    });
    if(fcount) fcount.textContent = want==="all" ? shown+" pairs"
                                      : shown+" of "+document.querySelectorAll(".cmp").length;
    try{ localStorage.setItem("clipsFilter",want); }catch(e){}
  }
  if(filt){
    filt.onchange=applyFilter;
    try{
      var saved=localStorage.getItem("clipsFilter");
      if(saved && filt.querySelector('option[value="'+saved+'"]')) filt.value=saved;
    }catch(e){}
  }
  applyFilter();
  var lb=document.getElementById("loopall");
  if(lb)
  lb.onclick=function(){
    looping=!looping; lb.textContent="Loop: "+(looping?"on":"off");
    if(open&&open.live){ open.va.loop=looping; open.vb.loop=looping; }
  };

  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"){ if(open) open.teardown(); return; }
    var u=open; if(!u||!u.live) return;
    if(e.target&&/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if(e.key==="f"||e.key==="F"){ if(mode==="flip"){ e.preventDefault(); u.doFlip(); } }
    else if(e.key===" "){ e.preventDefault(); u.setPlay(u.va.paused); }
    else if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
      e.preventDefault();
      var d=(e.key==="ArrowRight"?1:-1)/24;
      u.setPlay(false);
      u.va.currentTime=Math.max(0,u.va.currentTime+d);
      u.vb.currentTime=u.va.currentTime;
      u.fnum.textContent="frame "+frameOf(u.va);
    }
  });
  setMode("flip");
  window.ReviewPlayer={rescan:function(){document.querySelectorAll(".cmp").forEach(initCmp);},
                       setMode:setMode,
                       closeOpen:function(){ if(open) open.teardown(); }};
})();
