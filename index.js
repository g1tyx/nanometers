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
  give cells a strength and power and owned
  make power transfer between owned cells
  make power attack strength of unowned cells
  player attack power is function of attack strength of the attacking cell
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
  
  unselect all cells if you click outside the grid


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
    this.initGrid();

    setInterval(() => this.update(), 1000/60);
    this.draw();
  }


  loadFromStorage() {
    const rawState = localStorage.getItem('nanometers');

    this.state = {
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
  initGrid() {
    const container = document.getElementById('gridContainer');

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const d = document.createElement('div');
        const id = `gridCellContainer${x}_${y}`;
        d.id = id;
        this.UI[id] = d;
        d.style.gridArea = `${y + 1} / ${x + 1} / ${y + 2} / ${x + 2}`;
        d.style.backgroundColor = `hsl(${360 * Math.random()}, 50%, 50%)`;

        d.classList.add('gridCellContainer');
        d.setAttribute('tabindex', '-1');

        this.arrowDirs.forEach( dir => {
          const arrow = document.createElement('div');
          arrow.id = `${d.id}_${dir}`;
          this.UI[arrow.id] = arrow;
          arrow.classList.add(`${dir}Arrow`);
          d.append(arrow);
        });

        container.append(d);
        d.onclick = () => this.selectCell(x, y);
        d.onkeydown = (evt) => this.keydownCell(evt, x, y);
        //d.onclick = (evt) => this.createParticle(evt);

      }
    }
  }

  update() {
    const t = (new Date()).getTime();

  }

  draw() {
    let a = 1;

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

  setCellArrow(x, y, targetDir) {
    this.arrowDirs.forEach( dir => {
      this.UI[`gridCellContainer${x}_${y}_${dir}`].style.display = dir === targetDir ? 'block' : 'none';
    });
  }

  selectCell(x, y) {
    const curSelectedElement = document.getElementsByClassName('cellSelected');
    if (curSelectedElement.length > 0) {
      for (let i = 0; i < curSelectedElement.length; i++) {
        curSelectedElement.item(i).classList.remove('cellSelected');
      }
    }
    this.UI[`gridCellContainer${x}_${y}`].classList.add('cellSelected');
    this.selectedCell = {x, y, e: this.UI[`gridCellContainer${x}_${y}`]};
  }

  keydownCell(evt, x, y) {
    const key = evt.key;
    console.log('press', key);
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
    this.setCellArrow(x, y, action);
  }
}

const app = new App();
