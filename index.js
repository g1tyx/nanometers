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
  constructor() {
    console.log('init');

    this.loadFromStorage();


    this.arrowDirs = ['left', 'right', 'up', 'down'];
    this.selectedCell = undefined;
    this.UI = {};
    this.initGrid(0);

    setInterval(() => this.update(), 1000/60);
    setInterval(() => this.saveToStorage(), 30 * 1000);
    this.draw();
  }


  loadFromStorage() {
    const rawState = localStorage.getItem('nanometers');

    this.state = {
      savedTime: 0,
      lastTime: (new Date()).getTime()
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


  //Copied from Nanospread
  colorShiftMath(initialColor, multi, leftOverMulti) {
      //Hue is 0-360, 0 is red, 120 is green, 240 is blue. Sat is 0-100, 0=greyscale. Light is 0-100, 25=half black
      let hue = initialColor - (multi-1)*30; //- (leftOverMulti)*9;
      let sat = 10+Math.pow(multi, .8) * 2; //+ (leftOverMulti)*3
      sat = sat > 100 ? 100 : sat; //multi^.9 * 6 reaches at 23
      let light = 50;
      return "hsl("+hue+", "+sat+"%, "+light+"%)";
  }

  initGrid(level) {
    const container = document.getElementById('gridContainer');

    this.state.grid = new Array(16);
    for (let y = 0; y < 16; y++) {
      const gridRow = new Array(16);
      this.state.grid[y] = gridRow;
      for (let x = 0; x < 16; x++) {
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
          //d.onclick = (evt) => this.createParticle(evt);
          
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
          progressDiv.classList.add('gridProgress');
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
        const locked = type === '#' ? false : true;
        gridRow[x] = {
          type,
          nanites,
          power,
          dir: '',
          locked
        };

      }
    }

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
        if (ny >= 16) {return undefined;}
        return this.state.grid[ny][x];
      }
      case 'left': {
        const nx = x - 1;
        if (nx < 0) {return undefined;}
        return this.state.grid[y][nx];
      }
      case 'right': {
        const nx = x + 1;
        if (nx >= 16) {return undefined;}
        return this.state.grid[y][nx];
      }
    }
    return undefined;
  }

  tick() {
    const nanitesRate = 1;
    const transferRate = 0.01;

    for (let y = 0; y < 16; y++) {
      const gridRow = this.state.grid[y];
      for (let x = 0; x < 16; x++) {
        const cell = gridRow[x];
        if (cell.type === '#') {
          cell.nanites += nanitesRate;
          if (cell.dir !== '') {
            const neighbor = this.getNeighbor(x, y, cell.dir);
            if (neighbor !== undefined && neighbor.type === '#') {
              const transferCount = cell.nanites * transferRate;
              cell.nanites -= transferCount;
              neighbor.nanites += transferCount;
            }
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

  draw() {
    const colors = {
      '.': 'transparent',
      '#': 'green',
      'r': 'blue',
      'e': 'yellow'
    };
    for (let y = 0; y < 16; y++) {
      const gridRow = this.state.grid[y];
      for (let x = 0; x < 16; x++) {
        const cell = gridRow[x];
        if (cell.type !== '.') {
          const eCon = this.UI[`gridCellContainer${x}_${y}`];
          const ni = (x + y * 16 + 1);
          const nanites = cell.nanites;
          //eCon.style.backgroundColor = this.getUnlockedColor(cell.nanites);
          const eBG = this.UI[`gridCellBackground${x}_${y}`];
          if (cell.locked) {
            eBG.style.backgroundColor = colors[cell.type];
          } else {
            eBG.style.backgroundColor = this.getUnlockedColor(cell.nanites);
          }
          
          const eFG = this.UI[`gridCellForeground${x}_${y}`];
          eFG.innerText = cell.nanites.toExponential(1);

        }
      }
    }
    window.requestAnimationFrame(() => this.draw());
  }

  createParticle(evt) {
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

    const rect = evt.target.getBoundingClientRect();
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

  setCellDir(x, y, targetDir) {
    this.arrowDirs.forEach( dir => {
      this.UI[`gridCellContainer${x}_${y}_${dir}`].style.display = dir === targetDir ? 'block' : 'none';
    });
    this.state.grid[y][x].dir = targetDir;
  }

  clickCell(x, y) {
    this.selectCell(x, y);
    const cell = this.state.grid[y][x];
    switch (cell.type) {
      case '#': {
        break;
      }
      case 'r': {
        if (cell.locked) { return; }
        break;
      }
      case 'e': {
        if (cell.locked) { return; }
        break;
      }
    }

  }

  selectCell(x, y) {
    const curSelectedElement = document.getElementsByClassName('cellSelected');
    if (curSelectedElement.length > 0) {
      for (let i = 0; i < curSelectedElement.length; i++) {
        curSelectedElement.item(i).classList.remove('cellSelected');
      }
    }
    if (this.state.grid[y][x].type !== '.') {
      this.UI[`gridCellContainer${x}_${y}`].classList.add('cellSelected');
      this.selectedCell = {x, y, e: this.UI[`gridCellContainer${x}_${y}`]};
    }
  }

  keydownCell(evt, x, y) {
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
    this.setCellDir(x, y, action);
  }
}

const app = new App();
