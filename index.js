'use strict';

/*
game links:
https://www.andyslife.org/games/game.php?file=300&title=Parameters
http://nekogames.jp/g2.html?gid=PRM
http://stopsign.github.io/Nanospread/

some details here:
https://jayisgames.com/review/parameters.php

TODO:
  Nanospread is released under MIT license
  some cells are just resources and don't fight back
  some cells do fight back and regen health
  give cells a strength and power and owned
  make power transfer between owned cells
  make power attack strength of unowned cells
  unselect all cells if you click outside the grid
  player attack power is function of attack strength of the attacking cell
  player can set keybinds
  use won exp to improve 
    attack power, 
    transfer speed,
    generator speed
  locked cells should display their strength, light gray on green 
  unlocked cells display strength and level
  cells create their own nanites each tick
  cells transfer out nanites each tick
  cells transfer in nanites each tick
  randomly collect letters in ?some word? (originally NEKOGAMES) to unlock
    a secret room...that does what?
  need multiple maps
  all cells get upgraded together
    act
    atk
    def
  attacking works similar to risk
  need smaller grid but make areas be able to span multiple cells
  use particles to show the flow of power
  add inspiration links to info box

  costs:
  1: 10 => +1
  2: 20 => +1
  ...
  9: 90 => +1
  10: 150 => +2
  11: 200 => +2
  12: 250 => +2
  ...
  24: 850 => +2
  25: 1500 => +4
  26: 1750 => +4
  


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
      savedTime: 0,
      lastTime: (new Date()).getTime(),
      exp: 0,
      life: 100,
      lifeMax: 100,
      act: 50,
      actMax: 50,
      rcv: 10,
      atk: 10,
      def: 10,
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

  //Copied from Nanospread
  colorShiftMath(initialColor, multi, leftOverMulti) {
      //Hue is 0-360, 0 is red, 120 is green, 240 is blue. Sat is 0-100, 0=greyscale. Light is 0-100, 25=half black
      let hue = initialColor - (multi-1)*30; //- (leftOverMulti)*9;
      let sat = 10+Math.pow(multi, .8) * 2; //+ (leftOverMulti)*3
      sat = sat > 100 ? 100 : sat; //multi^.9 * 6 reaches at 23
      let light = 50;
      return "hsl("+hue+", "+sat+"%, "+light+"%)";
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
  }

  initGrid() {
    const container = document.getElementById('gridContainer');

    /*
    this.state.grid = new Array(this.gridSize);
    for (let y = 0; y < this.gridSize; y++) {
      const gridRow = new Array(this.gridSize);
      this.state.grid[y] = gridRow;
      for (let x = 0; x < this.gridSize; x++) {
        const d = document.createElement('div');
        const id = `gridCellContainer${x}_${y}`;
        if (this.UI[id]) {
          this.UI[id].remove();
        }

        d.id = id;
        d.onclick = () => this.clickCell(x, y);

        this.UI[id] = d;
        d.style.gridArea = `${y + 1} / ${x + 1} / ${y + 2} / ${x + 2}`;
        const symbol = levelData[level].grid[y][x];
        let type;
        if (symbol === '.') {
          type = '.';
        } else if (symbol === '#') {
          type = '#';
        } else if (symbol.toLowerCase() === symbol) {
          type = 'r';
        } else if (symbol.toUpperCase() === symbol) {
          type = 'e';
        } else {
          throw `UNKNOWN LEVEL DATA SYMBOL ${symbol} ${x} ${y}`;
        }

        if (type != '.') {
          d.classList.add('gridCellContainer');
          d.setAttribute('tabindex', '-1');

          this.arrowDirs.forEach( dir => {
            const arrow = document.createElement('div');
            arrow.id = `${d.id}_${dir}`;
            this.UI[arrow.id] = arrow;
            arrow.classList.add(`${dir}Arrow`);
            d.append(arrow);
          });
          d.onkeydown = (evt) => this.keydownCell(evt, x, y);
          
          const displayDiv = document.createElement('div');
          const dName = `gridCellBackground${x}_${y}`;
          displayDiv.id = dName;
          displayDiv.classList.add('gridBackground');
          this.UI[dName] = displayDiv;

          d.appendChild(displayDiv);
        }

        if (type != '.' && type != '#') {
          const progressDiv = document.createElement('div');
          const pName = `gridCellProgress${x}_${y}`;
          progressDiv.id = pName;
          if (type === 'r') {
            progressDiv.classList.add('gridProgressResource');
          } else {
            progressDiv.classList.add('gridProgressEnemy');
          }
          this.UI[pName] = progressDiv;

          d.appendChild(progressDiv);
        }

        if (type !== '.') {
          const fgDiv = document.createElement('div');
          const fgName = `gridCellForeground${x}_${y}`;
          fgDiv.id = fgName;
          fgDiv.classList.add('gridForeground');
          this.UI[fgName] = fgDiv;

          d.appendChild(fgDiv);
        }

        container.append(d);


        const nanites = type === '#' ? 1 : 0;
        const power = type === '#' ? 0 : 1;
        const locked = false;

        //Everything that goes into this object gets saved to localStorage
        gridRow[x] = {
          type,
          nanites,
          power,
          dir: '',
          locked
        };

      }
    }
    */

    //map of symbol to grid locations
    const areaLocations = {};
    //map of grid location to symbol
    const locationAreas = {};
    //map of symbol to index;
    const symbolIndexes = {};
    this.areaLocations = areaLocations;
    this.locationAreas = locationAreas;
    this.symbolIndexes = symbolIndexes;

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

    //have to account for 1px border
    const cellSize = 40 - 2 * 1;

    this.areas.forEach( (area, i) => {
      symbolIndexes[area.sym] = i;
      const eArea = document.createElement('div');
      eArea.id = `div_area_${i}`;
      this.UI[eArea.id] = eArea;
      eArea.style.background = area.type === 'cell' ? 'gray' : 'yellow';
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

      const fgDiv = document.createElement('div');
      const fgName = `area_fg_${i}`;
      fgDiv.id = fgName;
      fgDiv.classList.add('cellForeground');
      this.UI[fgName] = fgDiv;
      fgDiv.textContent = '1e2';

      eArea.append(fgDiv);

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

        eArea.append(arrow);

        const areaState = {
        };

        switch (area.type) {
          case 'cell': {
            areaState.nanites = 0;
            areaState.lock = area.lock ?? 0;
            areaState.power = area.val;
            break;
          }
        }

        //overwrite default areaState with saved areaState
        this.state.areas[i] = {...areaState, ...this.state.areas[i]};
      });

      container.appendChild(eArea);
    });
  }

  getNeighbor(x, y, dir) {
    switch (dir) {
      case 'up': {
        const ny = y - 1;
        if (ny < 0) {return undefined;}
        return this.state.grid[ny][x];
      }
      case 'down': {
        const ny = y + 1;
        if (ny >= this.gridSize) {return undefined;}
        return this.state.grid[ny][x];
      }
      case 'left': {
        const nx = x - 1;
        if (nx < 0) {return undefined;}
        return this.state.grid[y][nx];
      }
      case 'right': {
        const nx = x + 1;
        if (nx >= this.gridSize) {return undefined;}
        return this.state.grid[y][nx];
      }
    }
    return undefined;
  }

  getNeighborCoord(x, y, dir) {
    switch (dir) {
      case 'up': {
        const ny = y - 1;
        if (ny < 0) {return undefined;}
        return {x, y: ny};
      }
      case 'down': {
        const ny = y + 1;
        if (ny >= this.gridSize) {return undefined;}
        return {x, y: ny};
      }
      case 'left': {
        const nx = x - 1;
        if (nx < 0) {return undefined;}
        return {x: nx, y};
      }
      case 'right': {
        const nx = x + 1;
        if (nx >= this.gridSize) {return undefined;}
        return {x: nx, y};
      }
    }
    return undefined;
  }

  //this happens once per tick period which starts at 1 per second
  tick() {
    return;
    const nanitesRate = 1;
    const transferRate = 0.01;

    for (let y = 0; y < this.gridSize; y++) {
      const gridRow = this.state.grid[y];
      for (let x = 0; x < this.gridSize; x++) {
        const cell = gridRow[x];
        switch (cell.type) {
          case '#': {
            cell.nanites += nanitesRate;
            if (cell.dir !== '') {
              const neighbor = this.getNeighbor(x, y, cell.dir);
              if (neighbor === undefined) {continue;}
              switch (neighbor.type) {
                case '#': {
                  const transferCount = cell.nanites * transferRate;
                  cell.nanites -= transferCount;
                  neighbor.nanites += transferCount;
                  break;
                }
                case 'r': {
                  break;
                }
                case 'e': {
                  break;
                }
                case '.': {
                  break;
                }
              }
            }
            break;
          }
          case 'e': {
            //recover cell health
            const recovery = cell.power * 0.1;
            cell.nanites = Math.max(0, cell.nanites - recovery);

            if (cell.nanites > 0) {
              //damage player
              //TODO: damage player
            }
            break;
          }
        }
      }
    }
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
    const h = 120 + (OOM * 30) % (315 - 120);
    const s = 30 + Math.floor((OOM * 30) / (315 - 120)) * 5;
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

  draw() {

    const colors = {
      '.': 'transparent',
      '#': 'green',
      'r': 'blue',
      'e': 'red'
    };

    this.areas.forEach( (area, i) => {
      const state = this.state.areas[i];
      const fgDiv = this.UI[`area_fg_${i}`];
      fgDiv.textContent = state.nanites;
    });

    
    const curTime = (new Date()).getTime();
    if (this.state.endTime === undefined) {
      this.UI.spanPlayTime.textContent = this.remainingToStr(curTime - this.state.gameStart, true);
    } else {
      this.UI.spanPlayTime.textContent = this.remainingToStr(this.state.endTime - this.state.gameStart, true);
    }

    window.requestAnimationFrame(() => this.draw());

    return;
    for (let y = 0; y < this.gridSize; y++) {
      const gridRow = this.state.grid[y];
      for (let x = 0; x < this.gridSize; x++) {
        const cell = gridRow[x];
        if (cell.type === '.') {continue;}
        const eBG = this.UI[`gridCellBackground${x}_${y}`];
        const eFG = this.UI[`gridCellForeground${x}_${y}`];
        switch (cell.type) {
          case '#': {
            eBG.style.backgroundColor = this.getUnlockedColor(cell.nanites);
            eFG.innerText = cell.nanites.toExponential(1);

            break;
          }
          case 'r': {
            eBG.style.backgroundColor = colors[cell.type];
            const f = Math.max(0, 1 - cell.nanites / cell.power);
            this.setGridProgress(x, y, f);
            
            eFG.innerText = cell.power.toExponential(1);
            break;
          }
          case 'e': {
            eBG.style.backgroundColor = colors[cell.type];
            const f = Math.max(0, 1 - cell.nanites / cell.power);
            this.setGridProgress(x, y, f);
            
            eFG.innerText = cell.power.toExponential(1);
            break;
          }
        }

        if (cell.type !== '.') {

        }
      }
    }
    window.requestAnimationFrame(() => this.draw());
  }

  createParticle(gridx, gridy) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particle.innerText = '$*X#'[Math.floor(Math.random() * 4)];
    document.body.appendChild(particle);

    particle.onmouseenter = (evt) => {
      console.log('move');
      const curTime = (new Date()).getTime();
      const deltaTime = curTime - particle.startTime;
      if (deltaTime > 500) {
        particle.remove();
      }
    };

    particle.startTime = (new Date()).getTime();

    particle.style.width = '10px';
    particle.style.height = '10px';

    const rect = this.UI[`gridCellBackground${gridx}_${gridy}`].getBoundingClientRect();
    const x = rect.left;
    const y = rect.top;

    let x0 = rect.left;
    let y0 = rect.top;
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
    
    //TODO: set state of cell direction
    const areaDiv = this.getAreaElementFromSym(sym);
    const areaIndex = this.symbolIndexes[sym];

    this.arrowDirs.forEach( dir => {
      this.UI[`div_area_arrow_${areaIndex}_${dir}`].style.display = dir === targetDir ? 'block' : 'none';
    });

  }

  clickArea(sym) {
    this.selectArea(sym);

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
}

const app = new App(AREAS, AREAS_GRID);
