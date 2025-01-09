'use strict';

/*
game links:
https://www.andyslife.org/games/game.php?file=300&title=Parameters
http://nekogames.jp/g2.html?gid=PRM
http://stopsign.github.io/Nanospread/

some details here:
https://jayisgames.com/review/parameters.php

TODO:
  player can set keybinds
  use won exp to improve 
    attack power, 
    transfer speed,
    generator speed
  randomly collect letters in ?some word? (originally NEKOGAMES) to unlock
    a secret room...that does what?
  all cells get upgraded together
    act
    atk
    def
  use particles to show the flow of power
  add inspiration links to info box
  add area in info box to show details about selected area
  drop points and letters when cell shield breaks
  


parameters english help text:
How to play
- Complete the game by defeating every enemy
-Money ($) and EXP a re collected by mousing over them.
About Item
- Keys can be earned by defeating enemies, or can be purchased in the shop.
- You can buy wewapons and armor for ATK and DEF bonuses, up to 9 of each individual type.
About parameter
  RCV determines how fast you recover life, when not fighting enemies, and activity points
  (ACT), when not on a mission.
  ATK determines the strength of your attacks.
  DEF determines how much damage you take from enemies.

*/

class App {
  constructor(areas, areasGrid) {
    console.log('init');
    this.areas = areas;
    this.areasGrid = areasGrid;

    this.loadFromStorage();


    this.arrowDirs = ['left', 'right', 'up', 'down'];
    this.selectedCell = undefined;
    this.gridSize = 20;
    this.initUI();
    this.initGrid();

    setInterval(() => this.update(), 1000/60);
    setInterval(() => this.saveToStorage(), 5 * 1000);
    this.draw();
  }

  loadFromStorage() {
    const rawState = localStorage.getItem('nanometers');

    this.state = {
      lastTime: (new Date()).getTime(),
      cash: 0,
      exp: 0,
      life: 100,
      lifeMax: 100,
      act: 50,
      actMax: 50,
      rcv: 10,
      atk: 10,
      def: 10,
      keysCount: 0,
      keygCount: 0,
      areas: {}
    };

    if (rawState !== null) {
      const loadedState = JSON.parse(rawState);
      this.state = {...this.state, ...loadedState};
    } else {
      this.state.gameStart = (new Date()).getTime();
    }

    this.saveToStorage();
  }

  saveToStorage() {
    if (this.disableSaves) {return;}

    const saveString = JSON.stringify(this.state);
    localStorage.setItem('nanometers', saveString);
  }

  reset() {
    this.disableSaves = true;
    localStorage.removeItem('nanometers');
    window.location.reload();
  }

  genExportStr() {
    return btoa(JSON.stringify(this.state));
  }

  export() {
    this.UI.imexText.value = this.genExportStr();
  }

  import() {
    const importString = this.UI.imexText.value.trim();

    const decodedStr = atob(importString);

    let state;
    try {
      state = JSON.parse(decodedStr);
    } catch (error) {
      console.error("Corrupted import string. JSON.parse check failed.");
      console.log(error);
      return;
    }

    this.disableSaves = true;
    localStorage.setItem('nanometers', decodedStr);
    window.location.reload();
  }

  showModal(name) {
    this.UI[name].showModal();  
  }

  closeModal(name) {
    this.UI[name].close();
  }

  initUI() {
    this.UI = {};

    //get all the elements from the static HTML
    const namedElements = document.querySelectorAll('*[id]');
    for (let i = 0; i < namedElements.length; i++) {
      const namedElement = namedElements.item(i);
      this.UI[namedElement.id] = namedElement;
    }

    this.UI.body = document.querySelector('body');

    this.UI.btnHelp.onclick = () => { this.showModal('helpContainer'); }
    this.UI.helpClose.onclick = () => { this.closeModal('helpContainer'); }
    this.UI.btnImpExp.onclick = () => { this.showModal('imexContainer'); }
    this.UI.imexClose.onclick = () => { this.closeModal('imexContainer'); }
    this.UI.imexImport.onclick = () => { this.import(); };
    this.UI.imexExport.onclick = () => { this.export(); };
    this.UI.btnReset.onclick = () => { this.showModal('resetContainer'); }
    this.UI.resetNo.onclick = () => { this.closeModal('resetContainer'); }
    this.UI.resetYes.onclick = () => { this.reset(); }
    this.UI.winClose.onclick = () => { this.closeModal('winContainer'); }

    this.UI.spanKeyCountS.textContent = this.state.keysCount;
    this.UI.spanKeyCountG.textContent = this.state.keygCount;
    this.UI.cash.textContent = this.formatCash();
  }

  initGrid() {
    const container = document.getElementById('gridContainer');

    //map of symbol to grid locations
    const areaLocations = {};
    //map of grid location to symbol
    const locationAreas = {};
    //map of symbol to index;
    const symbolIndexes = {};
    this.areaLocations = areaLocations;
    this.locationAreas = locationAreas;
    this.symbolIndexes = symbolIndexes;
    this.specialIndexes = {};

    this.areasGrid.forEach( (row, y) => {
      row.split('').forEach( (sym, x) => {
        let info = areaLocations[sym];
        if (info === undefined) {
          info = {x, y, w: 1, h: 1};
          areaLocations[sym] = info;
        } else {
          info.w = (x - info.x) + 1;
          info.h = (y - info.y) + 1;
        }
        locationAreas[`${x},${y}`] = sym;
      });
    });

    this.areas.forEach( (area, i) => {
      symbolIndexes[area.sym] = i;
      if (area.type !== 'cell') {
        this.specialIndexes[area.type] = i;
      }
    });

    let sum = 0;
    AREAS_ORDER.split('').forEach( (sym, i) => {
      const areaIndex = this.symbolIndexes[sym];

      if (i === 0) {
        AREAS[areaIndex].val = 1;
      } else {
        //scale(1) = 2
        //scale(74) = 10
        //y=mx+b
        //b = y- mx 
        const slope = (10 - 2) / (74 - 1);
        const b = 2 - slope * 1;
        const scale = slope * i + b ;
        AREAS[areaIndex].val = sum * scale;
      }

      sum = sum + AREAS[areaIndex].val;
    });

    //have to account for 1px border
    const cellSize = 40 - 2 * 1;

    this.areas.forEach( (area, i) => {
      const eArea = document.createElement('div');
      eArea.id = `div_area_${i}`;
      this.UI[eArea.id] = eArea;
      eArea.style.background = 'gray';
      const info = areaLocations[area.sym];
      eArea.style.gridColumnStart = info.x + 1;
      eArea.style.gridColumnEnd = info.x + info.w + 1;
      eArea.style.gridRowStart = info.y + 1;
      eArea.style.gridRowEnd = info.y + info.h + 1;
      eArea.classList.add('areaContainer');

      eArea.onclick = () => this.clickArea(area.sym);
      //to allow keyboard events
      eArea.setAttribute('tabindex', '-1');
      eArea.onkeydown = (evt) => this.keydownArea(evt, area.sym);

      //add progress bar
      const eProgress = document.createElement('div');
      eProgress.id = `div_area_progress_${i}`;
      this.UI[eProgress.id] = eProgress;
      eProgress.classList.add('areaProgress');

      switch (area.type) {
        case 'rpgp':
        case 'slot':
        case 'keys':
        case 'keyg': {
          eProgress.style.backgroundColor = 'yellow';
          break;
        }
        case 'spawn': {
          eProgress.style.width = '0%';
          break;
        }
      }

      eArea.appendChild(eProgress);
      
      //add fg div
      const fgDiv = document.createElement('div');
      const fgName = `area_fg_${i}`;
      fgDiv.id = fgName;
      fgDiv.classList.add('cellForeground');
      this.UI[fgName] = fgDiv;

      switch (area.type) {
        case 'keyg':
        case 'keys': {
          fgDiv.innerHTML = `
            <div>
              <span class='keyPlus'>+</span><img src='${area.type === 'keys' ? 'silver' : 'gold'}Key.png'>
            </div>
            <div id='div_${area.type}_cost' class='keyCost'>KEY COST</div>
          `;
          break;
        }
      }

      eArea.appendChild(fgDiv);

      //add arrows
      const pw = cellSize * info.w;
      const ph = cellSize * info.h;
      const arrowWidth = 8; 
      this.arrowDirs.forEach( dir => {
        const arrow = document.createElement('div');
        arrow.id = `div_area_arrow_${i}_${dir}`;
        this.UI[arrow.id] = arrow;
        arrow.classList.add(`${dir}Arrow`);

        switch (dir) {
          case 'left': {
            const tsize = ph / 2;
            arrow.style.borderTop = `${tsize}px solid transparent`;
            arrow.style.borderBottom = `${tsize}px solid transparent`;
            arrow.style.borderRight = `${arrowWidth}px solid black`;
            break;
          }
          case 'right': {
            const tsize = ph / 2;
            arrow.style.borderTop = `${tsize}px solid transparent`;
            arrow.style.borderBottom = `${tsize}px solid transparent`;
            arrow.style.borderLeft = `${arrowWidth}px solid black`;
            break;
          }
          case 'up': {
            const tsize = pw / 2;
            arrow.style.borderLeft = `${tsize}px solid transparent`;
            arrow.style.borderRight = `${tsize}px solid transparent`;
            arrow.style.borderBottom = `${arrowWidth}px solid black`;
            break;
          }
          case 'down': {
            const tsize = pw / 2;
            arrow.style.borderLeft = `${tsize}px solid transparent`;
            arrow.style.borderRight = `${tsize}px solid transparent`;
            arrow.style.borderTop = `${arrowWidth}px solid black`;
            break;
          }
        }

        eArea.appendChild(arrow);

      });


      //set up area state
      const areaState = {
      };

      switch (area.type) {
        case 'cell': {
          areaState.nanites = 0;
          areaState.lock = area.lock ?? 0;
          //[0,74]
          const areaOrder = AREAS_ORDER.indexOf(area.sym);

          areaState.shield = area.val;
          
          switch (areaState.lock) {
            case 1: {
              fgDiv.style.backgroundImage = 'url("silverKey.png")';
              break;
            }
            case 2: {
              fgDiv.style.backgroundImage = 'url("goldKey.png")';
              break;
            }
          }
          break;
        }
        case 'spawn': {
          areaState.nanites = 1;
          areaState.lock = 0;
          areaState.shield = 0;
          break;
        }
        case 'keys': {
          areaState.nanites = 0;
          areaState.lock = 0;
          areaState.bought = 0;
          areaState.shield = 10;
          areaState.val = 10;
          break;
        }
        case 'keyg': {
          areaState.nanites = 0;
          areaState.lock = 0;
          areaState.bought = 0;
          areaState.shield = 2e20;
          areaState.val = 2e20;
          break;
        }

      }

      //overwrite default areaState with saved areaState
      this.state.areas[i] = {...areaState, ...this.state.areas[i]};

      //init arrow displays
      const areaDir = this.state.areas[i].dir;

      //remove lock image from previously unlocked areas
      if (this.state.areas[i].lock === undefined || this.state.areas[i].lock === 0) {
        fgDiv.style.backgroundImage = '';
      }

      if (areaDir !== undefined) {
        this.setAreaDir(area.sym, areaDir);
      }

      container.appendChild(eArea);
      this.UI[`div_keys_cost`] = document.getElementById(`div_keys_cost`);
      this.UI[`div_keyg_cost`] = document.getElementById(`div_keyg_cost`);
    });
  }

  getAreaNeighbors(sym, dir) {
    const neighbors = [];

    const thisArea = this.areaLocations[sym];

    switch (dir) {
      case 'up': {
        const y = thisArea.y;
        for (let x = thisArea.x; x < thisArea.x + thisArea.w; x++) {
          const nx = x;
          const ny = y - 1;
          const narea = this.locationAreas[`${nx},${ny}`];
          if (narea !== undefined) {
            neighbors.push(narea);
          }
        }
        break;
      }
      case 'down': {
        const y = thisArea.y + thisArea.h - 1;
        for (let x = thisArea.x; x < thisArea.x + thisArea.w; x++) {
          const nx = x;
          const ny = y + 1;
          const narea = this.locationAreas[`${nx},${ny}`];
          if (narea !== undefined) {
            neighbors.push(narea);
          }
        }
        break;
      }
      case 'left': {
        const x = thisArea.x;
        for (let y = thisArea.y; y < thisArea.y + thisArea.h; y++) {
          const nx = x - 1;
          const ny = y;
          const narea = this.locationAreas[`${nx},${ny}`];
          if (narea !== undefined) {
            neighbors.push(narea);
          }
        }
        break;
      }
      case 'right': {
        const x = thisArea.x + thisArea.w - 1;
        for (let y = thisArea.y; y < thisArea.y + thisArea.h; y++) {
          const nx = x + 1;
          const ny = y;
          const narea = this.locationAreas[`${nx},${ny}`];
          if (narea !== undefined) {
            neighbors.push(narea);
          }
        }
        break;
      }
    }

    return neighbors.filter( nsym => {
      const nindex = this.symbolIndexes[nsym];
      const nstate = this.state.areas[nindex];
      return nstate.lock === 0;
    });
  }

  //this happens once per tick period which starts at 1 per second
  tick() {
 
    const generationRate = 1;
    const recoveryRate = 0.01;
    const transferRate = 0.01;

    this.areas.forEach( (area, i) => {
      const state = this.state.areas[i];
      switch (area.type) {
        case 'spawn': {
          //fall through
        }
        case 'cell': {
          if (state.shield > 0) {
            //recover shield
            state.shield = Math.min(area.val, state.shield + recoveryRate * area.val);
          } else {
            if (state.dir !== undefined) {
              const neighbors = this.getAreaNeighbors(area.sym, state.dir);
              if (neighbors.length > 0) {
                const transferVal = state.nanites * transferRate / neighbors.length;
                state.nanites -= transferVal;
                neighbors.forEach( nsym => {
                  const nindex = this.symbolIndexes[nsym];
                  const nstate = this.state.areas[nindex];
                  if (nstate.shield > 0) {
                    nstate.shield = Math.max(0, nstate.shield - transferVal);

                    if (nstate.shield <= 0 && AREAS[nindex].type === 'cell') {
                      if (nsym === '!') {
                        this.doGameWin();
                      } else {
                        this.doAreaWin(nsym);
                      }
                    }
                  } else {
                    nstate.nanites = Math.min(1e308, nstate.nanites + transferVal);
                  }
                });
              }
            }
            state.nanites += generationRate;
          }
          break;
        }
        case 'keyg':
        case 'keys': {
          if (state.shield <= 0) {
            //add a key
            const stateKey = `key${area.type === 'keys' ? 's' : 'g'}Count`;
            this.state[stateKey] += 1;
            state.bought += 1;

            //update key display in infobox
            const infoId = `spanKeyCount${area.type === 'keys' ? 'S' : 'G'}`;
            this.UI[infoId].textContent = this.state[stateKey];

            //reset shield
            state.shield = this.getKeyVal(area.type) - state.nanites; 
            state.val = state.shield;

            //set nanites to zero
            state.nanites = 0;
          }
        }
      }
    });
  }

  getKeyVal(keyType) {
    const areaIndex = this.specialIndexes[keyType];
    const boughtKeys = this.state.areas[areaIndex].bought;
    const base = keyType === 'keys' ? 10 : 2e20;
    const growthFactor = 2;
    return base * Math.pow(growthFactor, boughtKeys);
  }

  update() {
    const t = (new Date()).getTime();
    let deltaT = t - this.state.lastTime;
    const tickPeriod = 1000;
    const frameLimit = 1000 / 60;

    while (deltaT > tickPeriod) {
      this.tick();
      deltaT -= tickPeriod;
      const frameTime = (new Date()).getTime() - t;
      if (frameTime >= frameLimit) {
        break;
      }
    }


    this.state.lastTime = t - deltaT;
  }
  
  getUnlockedColor(n) {
    /*
    const OOM = Math.log10(n);
    const h = (OOM * 30) % 360;
    const s = 30 + (OOM % 1) * 70;
    const l = 50;
    */
    const OOM = Math.log10(n);
    //h in [120,315]
    //s in [30, 100]
    //h move first
    //const h = 120 + (OOM * 30) % (315 - 120);
    //const s = 30 + Math.floor((OOM * 30) / (315 - 120)) * 5;
    //const l = 50;
    //return `hsl(${h},${s}%,${l}%)`;
    const h = (OOM * 300 / 70) % 300;
    const s = 100;
    const l = 50;
    return `hsl(${h},${s}%,${l}%)`;
  }
  
  setGridProgress(x, y, f) {
    const eProgress = this.UI[`gridCellProgress${x}_${y}`];
    eProgress.style.width = `${f * 100}%`;
  }

  timeToObj(t) {
    const result = {};

    result.y = Math.floor(t / (365 * 24 * 60 * 60));
    t = t % (365 * 24 * 60 * 60);
    result.d = Math.floor(t / (24 * 60 * 60));
    t = t % (24 * 60 * 60);
    result.h = Math.floor(t / (60 * 60));
    t = t % (60 * 60);
    result.m = Math.floor(t / 60);
    t = t % 60;
    result.s = t;

    return result;
  }  

  remainingToStr(ms, full) {
    if (ms === Infinity) {
      return 'Infinity';
    }

    const timeObj = this.timeToObj(ms / 1000);

    if (full) {
      return `${timeObj.y}:${timeObj.d.toString().padStart(3,0)}:${timeObj.h.toString().padStart(2,0)}:${timeObj.m.toString().padStart(2,0)}:${timeObj.s.toFixed(1).padStart(4,0)}`;
    }

    //if (timeObj.y > 0 || timeObj.d > 0 || timeObj.h > 0) {
      //return `${timeObj.y}:${timeObj.d.toString().padStart(3,0)}:${timeObj.h.toString().padStart(2,0)}:${timeObj.m.toString().padStart(2,0)}`;
      return `${timeObj.y}:${timeObj.d.toString().padStart(3,0)}:${timeObj.h.toString().padStart(2,0)}:${timeObj.m.toString().padStart(2,0)}:${Math.ceil(timeObj.s).toString().padStart(2,0)}`;
    //} else {
      //return `${timeObj.m.toString().padStart(2,0)}:${timeObj.s.toFixed(1).padStart(4,0)}`;
    //  return `${timeObj.m.toString().padStart(2,0)}:${Math.ceil(timeObj.s).toString().padStart(2,0)}`;
    //}

  }

  formatNanitesForArea(val) {
    if (val === undefined) {return '';}

    //remove unnecessary + and insert zero width space so narrow
    //  divs will break the text in the right place
    //TODO: Make this round up
    return val.toExponential(1).replace('e+', '\u200be');
  }

  draw() {

    this.areas.forEach( (area, i) => {
      const state = this.state.areas[i];
      const fgDiv = this.UI[`area_fg_${i}`];
      const progDiv = this.UI[`div_area_progress_${i}`];
      const areaContDiv = this.UI[`div_area_${i}`];
      switch (area.type) {
        case 'cell': {
          if (state.shield <= 0) {
            fgDiv.textContent = this.formatNanitesForArea(state.nanites);
            progDiv.style.width = '0%';
            areaContDiv.style.backgroundColor = this.getUnlockedColor(state.nanites);
          } else {
            fgDiv.textContent = this.formatNanitesForArea(state.shield);
            const progressPercent = 100 * state.shield / area.val;
            progDiv.style.width = `${progressPercent}%`;
            areaContDiv.style.backgroundColor = this.getUnlockedColor(state.shield);
          }
          break;
        }
        case 'spawn': {
          fgDiv.textContent = this.formatNanitesForArea(state.nanites);
          areaContDiv.style.backgroundColor = this.getUnlockedColor(state.nanites);
          break;
        }
        case 'keyg':
        case 'keys': {
          const progressPercent = 100 * state.shield / state.val;
          progDiv.style.width = `${progressPercent}%`;
          const costDiv = this.UI[`div_${area.type}_cost`];
          costDiv.textContent = this.formatNanitesForArea(state.shield);
          break;
        }
      }
    });

    //update info box 
    const curTime = (new Date()).getTime();
    if (this.state.endTime === undefined) {
      this.UI.spanPlayTime.textContent = this.remainingToStr(curTime - this.state.gameStart, true);
    } else {
      this.UI.spanPlayTime.textContent = this.remainingToStr(this.state.endTime - this.state.gameStart, true);
    }

    window.requestAnimationFrame(() => this.draw());

  }

  formatCash() {
    return this.state.cash.toExponential(1);
  }

  createCashParticle(sym, value) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particle.innerText = '\u00a4'; //currency symbol. looks kinda like a nanobot...

    //chance to generate a gold particle
    const pBonus = 0.1;
    if (Math.random() < pBonus) {
      value = value * 2;
      particle.style.color = 'gold';
    }

    document.body.appendChild(particle);

    particle.onmouseenter = (evt) => {
      console.log('move', value);
      const curTime = (new Date()).getTime();
      const deltaTime = curTime - particle.startTime;
      if (deltaTime > 500) {
        particle.remove();
        this.state.cash += value;
        this.UI.cash.textContent = this.formatCash();
      }
    };

    particle.startTime = (new Date()).getTime();

    particle.style.width = '10px';
    particle.style.height = '10px';

    const areaIndex = this.symbolIndexes[sym];
    const rect = this.UI[`area_fg_${areaIndex}`].getBoundingClientRect();
    const x = rect.left + rect.width / 2 + 2 * window.scrollX;
    const y = rect.top + rect.height / 2 + 2 * window.scrollY;

    let x0 = rect.left + rect.width / 2 + window.scrollX;
    let y0 = rect.top + rect.height / 2 + window.scrollY;
    const frames = [];
    let fx = x0;
    let fy = y0;
    let dt = 0.01;
    let vx = (50 + Math.random() * 50) * Math.sin(Math.random() * 2 * Math.PI);
    let vy = -300 + Math.random() * 50;
    const g = 10;
    let t = 0;
    //TODO: keep particle in game area
    while (true) {
      vx = vx * 0.99;
      fx += vx * dt;
      vy = vy + g;
      fy += vy * dt;
      if (fy >= y0) {
        fy = y0;
        vy = -vy * 0.8;
      }

      frames.push({transform: `translate(${fx}px, ${fy}px)`});
      t = t + dt;

      if (Math.abs(vx) < 5 && Math.abs(vy) < 1  && Math.abs(fy - y0) < 1 && t > 1) {
        break;
      }
      if (t > 4) {
        console.log('limit');
        frames.push({transform: `translate(${fx}px, ${y0}px)`});
        break;
      }
    }
    particle.style.transform = `translate(${fx}px, ${fy}px)`;

    const animation = particle.animate(
    frames, {
      duration: 1000 * t,
      delay: 0
    });


    animation.onfinish = () => {
      //particle.remove();
    };
  }

  getAreaElementFromSym(sym) {
    const areaIndex = this.symbolIndexes[sym];
    const areaDiv = this.UI[`div_area_${areaIndex}`];
    return areaDiv;
  }

  setAreaDir(sym, targetDir) {
    
    const areaIndex = this.symbolIndexes[sym];
    const areaType = AREAS[areaIndex].type;
    if (areaType !== 'cell' && areaType !== 'spawn') {
      return;
    }
    const state = this.state.areas[areaIndex];
    if (state.shield !== undefined && state.shield > 0) {
      return;
    }

    const areaDiv = this.getAreaElementFromSym(sym);
    state.dir = targetDir;

    this.arrowDirs.forEach( dir => {
      this.UI[`div_area_arrow_${areaIndex}_${dir}`].style.display = dir === targetDir ? 'block' : 'none';
    });

  }

  attemptUnlock(sym) {
    const areaIndex = this.symbolIndexes[sym];
    const state = this.state.areas[areaIndex];
    if (state.lock !== undefined && state.lock > 0) {
      if (state.lock === 1) {
        if (this.state.keysCount > 0) {
          this.state.keysCount -= 1;
          state.lock = 0;
          //remove key symbol from area
          this.UI[`area_fg_${areaIndex}`].style.backgroundImage = '';
          //update info box
          this.UI.spanKeyCountS.textContent = this.state.keysCount;
        }
      } else {
        if (this.state.keygCount > 0) {
          this.state.keygCount -= 1;
          state.lock = 0;
          //remove key symbol from area
          this.UI[`area_fg_${areaIndex}`].style.backgroundImage = '';
          //update info box
          this.UI.spanKeyCountG.textContent = this.state.keygCount;
        }
      }
    }
  }

  clickArea(sym) {
    console.log('CLICK AREA:', sym);
   
    this.attemptUnlock(sym);

    this.selectArea(sym);
    //const areaIndex = this.symbolIndexes[sym];
    //const pDiv = this.UI[`div_area_progress_${areaIndex}`];
    //pDiv.style.backgroundColor = 'red';

  }

  selectArea(sym) {
    //unselect previous area 
    const curSelectedElement = document.getElementsByClassName('areaSelected');
    if (curSelectedElement.length > 0) {
      for (let i = 0; i < curSelectedElement.length; i++) {
        curSelectedElement.item(i).classList.remove('areaSelected');
      }
    }

    //select new cell
    const areaDiv = this.getAreaElementFromSym(sym);
    areaDiv.classList.add('areaSelected');
    this.selectedArea = sym;
  }

  keydownArea(evt, sym) {
    const key = evt.key;
    const keyMap = {
      w: 'up',
      a: 'left',
      s: 'down',
      d: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right'
    };
    const action = keyMap[key];
    if (action === undefined) {return;}
    evt.preventDefault();
    this.setAreaDir(sym, action);
  }

  doGameWin() {
    this.state.endTime = (new Date()).getTime();
    const playTime = this.state.endTime - this.state.gameStart;
    this.UI.winPlayTime.textContent = this.remainingToStr(playTime, true);
    this.showModal('winContainer');
    this.saveToStorage();
  }

  doAreaWin(sym) {
    const areaIndex = this.symbolIndexes[sym];
    const areaVal = AREAS[areaIndex].val;
    const minP = 2;
    const maxP = 6;
    const pCount = minP + Math.floor(Math.random() * (maxP - minP + 1));
    for (let i = 0; i < pCount; i++) {
      this.createCashParticle(sym, areaVal / pCount);
    }
  }
}

const app = new App(AREAS, AREAS_GRID);
