'use strict';

/*
game links:
https://www.andyslife.org/games/game.php?file=300&title=Parameters
http://nekogames.jp/g2.html?gid=PRM
http://stopsign.github.io/Nanospread/

some details here:
https://jayisgames.com/review/parameters.php

TODO:
*/

class App {
  constructor(areas, areasGrid, areasOrder) {
    console.log('init');
    this.areas = areas;
    this.areasGrid = areasGrid;
    this.areasOrder = areasOrder;

    this.loadFromStorage();


    this.arrowDirs = ['left', 'right', 'up', 'down'];
    this.letterColors = ['hsl(347, 62%, 54%)', 'hsl(112, 62%, 54%)', 'hsl(185, 62%, 54%)', 'hsl(251, 62%, 54%)'];
    this.selectedCell = undefined;
    this.gridSize = 20;
    this.particleCount = 0;
    this.totalGeneration = 0;
    this.lastLetterCount = 0;
    this.slotDeck = [];
    this.initAudio();
    this.initUI();
    this.initGrid();
    this.updateStatsDisplay();
    this.updateLettersDisplay();
    this.showModal('helpContainer');

    const missingCash = this.state.cashGenerated - this.state.cashCollected;
    if (missingCash > 0) {
      this.state.cash += missingCash;
      this.state.cashCollected = this.state.cashGenerated;
    }

    setInterval(() => this.update(), 1000/60);
    setInterval(() => this.saveToStorage(), 5 * 1000);
    this.draw();
  }

  loadFromStorage() {
    const rawState = localStorage.getItem('nanometers');

    this.state = {
      lastTime: (new Date()).getTime(),
      cash: 0,
      genCount: 0,
      transCount: 0,
      recCount: 0,
      keysCount: 0,
      keygCount: 0,
      areas: {},
      letters: [0,0,0,0,0,0,0,0,0,0],
      cashGenerated: 0,
      cashCollected: 0,
      sfx: 1,
      shake: 1,
      color: 'str'
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
    const json = JSON.stringify(this.state);

    const emojiBase = 0x1f600;
    const result = json.split('').map( c => {
      const code = c.charCodeAt(0);
      const c1 = String.fromCodePoint(emojiBase + (code & 0x0f));
      const c2 = String.fromCodePoint(emojiBase + ((code >> 4) & 0x0f));
      return c1+c2;
    }).join('');
    return result;
  }

  export() {
    this.UI.imexText.value = this.genExportStr();
  }

  decodeExportStr(str) {
    const emojiBase = 0x1f600;
    let json = '';
    const splitStr = [...str];
    for (let i = 0; i < splitStr.length; i += 2) {
      const c1 = splitStr[i].codePointAt(0) - emojiBase;
      const c2 = splitStr[i+1].codePointAt(0) - emojiBase;
      const code = String.fromCharCode(c1 | (c2 << 4));
      json += code;
    }
    return json;
  }

  import() {
    const importString = this.UI.imexText.value.trim();

    const decodedStr = this.decodeExportStr(importString);

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
    if (this.audioReady === 0) {
      app.audioContext.resume();
      this.audioReady = 1;
    } 
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
    this.UI.statsGenBuy.onclick = () => { this.buyGen(); }
    this.UI.statsTransBuy.onclick = () => { this.buyTrans(); }
    this.UI.statsRecBuy.onclick = () => { this.buyRec(); }
    this.UI.areaInfoUpgradeButton.onclick = () => { this.buyUpgrade(); }
    this.UI.chkSFX.onchange = () => this.state.sfx = +(this.UI.chkSFX.checked);
    this.UI.chkShake.onchange = () => this.state.shake = +(this.UI.chkShake.checked);
    this.UI.rdoStrength.onchange = () => { if (this.UI.rdoStrength.checked) {this.changeColor('str');} };
    this.UI.rdoGen.onchange =      () => { if (this.UI.rdoGen.checked)      {this.changeColor('gen');} };
    this.UI.rdoNet.onchange =      () => { if (this.UI.rdoNet.checked)      {this.changeColor('net');} };
    this.UI.rdoUpgrades.onchange = () => { if (this.UI.rdoUpgrades.checked) {this.changeColor('upg');} };
    this.UI.rdoStrength.checked = this.state.color === 'str';
    this.UI.rdoGen.checked = this.state.color === 'gen';
    this.UI.rdoNet.checked = this.state.color === 'net';
    this.UI.rdoUpgrades.checked = this.state.color === 'upg';

    this.changeColor(this.state.color);

    this.UI.spanKeyCountS.textContent = this.state.keysCount;
    this.UI.spanKeyCountG.textContent = this.state.keygCount;
    this.UI.cash.textContent = this.roundExp(this.state.cash, 3, 'floor');
    this.UI.chkSFX.checked = this.state.sfx;
    this.UI.chkShake.checked = this.state.shake;

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
    this.generation = [];
    this.incoming = [];
    this.outgoing = [];

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
      this.generation[i] = 0;
      this.incoming[i] = 0;
      this.outgoing[i] = 0;
    });

    let sum = 0;
    this.areasOrder.split('').forEach( (sym, i) => {
      const areaIndex = this.symbolIndexes[sym];

      if (i === 0) {
        this.areas[areaIndex].val = 1;
      } else {
        this.areas[areaIndex].val = Math.pow(2, i);
      }

      sum = sum + this.areas[areaIndex].val;
    });

    //have to account for 1px border
    const cellSize = 40 - 2 * 1;

    this.areas.forEach( (area, i) => {
      if (area.sym === 'X') {
        let a = 1;
      }
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
          areaState.upgrades = 0;
          areaState.nanites = 0;
          areaState.lock = area.lock ?? 0;
          //[0,74]
          const areaOrder = this.areasOrder.indexOf(area.sym);

          areaState.shield = area.val;
          
          break;
        }
        case 'spawn': {
          areaState.upgrades = 0;
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
          areaState.shield = 1e10;
          areaState.val = 1e10;
          break;
        }
        case 'rpgp': {
          areaState.nanites = 0;
          areaState.shield = 0;
          areaState.lock = 0;
          fgDiv.textContent = '\u26f2';
          fgDiv.style.fontSize = '36px';
          break;
        }
        case 'slot': {
          areaState.nanites = 0;
          areaState.shield = 0;
          areaState.lock = 0;
          fgDiv.textContent = '\ud83c\udfb0';
          fgDiv.style.fontSize = '36px';
          break;
        }

      }

      //overwrite default areaState with saved areaState
      this.state.areas[i] = {...areaState, ...this.state.areas[i]};

      //init arrow displays
      const areaDir = this.state.areas[i].dir;

      //remove lock image from previously unlocked areas and make sure lock changes to magic if necessary
      if (this.state.areas[i].lock === undefined || this.state.areas[i].lock === 0) {
        fgDiv.style.backgroundImage = '';
      } else {
        fgDiv.style.backgroundImage = ['', 'url("silverKey.png")', 'url("goldKey.png")', 'url("magicKey.png")'][this.state.areas[i].lock];
      }

      if (areaDir !== undefined) {
        this.setAreaDir(area.sym, areaDir);
      }

      container.appendChild(eArea);
      this.UI[`div_keys_cost`] = document.getElementById(`div_keys_cost`);
      this.UI[`div_keyg_cost`] = document.getElementById(`div_keyg_cost`);
    });
  }

  initAudio() {
    this.audioReady = 0;
    this.audioSounds = {};
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();

    this.wavListToTracks('dropCoin,dropCoinHigh'.split(','), 'dropCoin');
    this.wavListToTracks('pickupCoin,pickupCoinHigh'.split(','), 'pickupCoin');
    this.wavListToTracks('explosion,explosionHigh'.split(','), 'explosion');
    this.wavListToTracks('slot'.split(','), 'slot');
    this.wavListToTracks('dropLetter,dropLetterHigh'.split(','), 'dropLetter');
    this.wavListToTracks('pickupLetter,pickupLetterHigh'.split(','), 'pickupLetter');
    this.wavListToTracks('useKey,useKey2'.split(','), 'useKey');
    this.wavListToTracks('getKey,getKeyHigh'.split(','), 'getKey');
    this.wavListToTracks('lettersComplete'.split(','), 'lettersComplete');

  }

  wavListToTracks(nameList, soundName) {
    this.audioSounds[soundName] = [];
    nameList.forEach( audioName => {
      const audioElement = new Audio(`./${audioName}.wav`);
      const track = this.audioContext.createMediaElementSource(audioElement);
      track.connect(this.audioContext.destination);
      this.audioSounds[soundName].push(audioElement);
    });
  }

  playAudio(soundName, index) {
    if (this.audioReady <= 0 || this.state.sfx === 0) {return;}
    const soundArray = this.audioSounds[soundName];
    const soundCount = soundArray.length;
    const soundIndex = index ?? Math.floor(Math.random() * soundCount);
    const sound = soundArray[soundIndex];
    sound.currentTime = 0;
    sound.play();
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
 
    const generationRate = this.getGenValue(this.state.genCount);
    const transferRate = this.getTransValue(this.state.transCount);
    const recoveryRate = this.getRecValue(this.state.recCount);

    this.totalNanites = 0;
    this.totalGeneration = 0;


    this.areas.forEach( (area, i) => {
      const state = this.state.areas[i];
      this.generation[i] = 0;
      this.incoming[i] = 0;
      this.outgoing[i] = 0;
      switch (area.type) {
        case 'spawn': {
          //fall through
        }
        case 'cell': {
          if (state.shield > 0) {
            //recover shield
            const recovery = recoveryRate * area.val;
            state.shield = Math.min(area.val, state.shield + recovery);
            this.generation[i] -= recovery;
          } else {
            if (state.dir !== undefined) {
              const neighbors = this.getAreaNeighbors(area.sym, state.dir);
              if (neighbors.length > 0) {
                const transferOutVal = state.nanites * transferRate;
                const transferInVal = transferOutVal / neighbors.length;
                state.nanites -= transferOutVal;
                this.outgoing[i] += transferOutVal;
                neighbors.forEach( nsym => {
                  const nindex = this.symbolIndexes[nsym];
                  const nstate = this.state.areas[nindex];
                  this.incoming[nindex] += transferInVal;
                  if (nstate.shield > 0) {
                    nstate.shield = Math.max(0, nstate.shield - transferInVal);

                    if (nstate.shield <= 0 && this.areas[nindex].type === 'cell') {
                      if (nsym === '!') {
                        this.doGameWin();
                      } else {
                        this.doAreaWin(nsym);
                      }
                    }
                  } else {
                    nstate.nanites = Math.min(1e308, nstate.nanites + transferInVal);
                  }
                });
              }
            }

            //const areaGenerationRate = generationRate * this.getUpgradeValue(i);
            const areaGenerationRate = generationRate * this.getUpgradeValue(i);
            //const testGen = areaGenerationRate + state.nanites * 0.01;

            this.totalGeneration += areaGenerationRate;
            state.nanites += areaGenerationRate;
            this.totalNanites += state.nanites;
            this.generation[i] += areaGenerationRate;
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
            this.playAudio('getKey');

            //update key display in infobox
            const infoId = `spanKeyCount${area.type === 'keys' ? 'S' : 'G'}`;
            this.UI[infoId].textContent = this.state[stateKey];

            //reset shield
            state.shield = this.getKeyVal(area.type) - state.nanites; 
            state.val = state.shield;

            //set nanites to zero
            state.nanites = 0;
          }
          break;
        }
        case 'rpgp': {
          if (state.nanites > 0) {
            //100% chance of converting all the nanites into cash (payout is slightly higher due to gold particles)
            const particleValue = state.nanites;
            const particleCount = Math.floor(Math.random() * 4) + 1;
            for (let i = 0; i < particleCount; i++) {
              setTimeout(() => this.createParticle(area.sym, 'cash', particleValue / particleCount), Math.random() * 1000);
            }
            state.nanites = 0;
            this.generation[i] = particleValue;
            //1% chance of generating a random letter
            if (Math.random() < 0.01) {
              const letterIndex = Math.floor(Math.random() * 10);
              this.createParticle(area.sym, 'letter', letterIndex);
            }
          }
          break;
        }
        case 'slot': {
          if (state.nanites > 0) {
            //1% chance of converting this tick's nanites into 1000-2000x cash, or a missing letter if needed
            if (this.getSlotResult()) {
              const letterCount = this.state.letters.reduce( (acc, e) => acc + e );
              this.playAudio('slot');
              if (letterCount < this.state.letters.length) {
                const letterIndex = this.state.letters.indexOf(0);
                this.createParticle(area.sym, 'letter', letterIndex);
              } else {
                const particleValue = state.nanites * 100 * (1 + Math.random());
                const particleTimes = 10;
                console.log(`slot win ${(particleValue * particleTimes).toExponential(3)}`);
                for (let i = 0; i < particleTimes; i = i + 1) {
                  setTimeout( () => this.createParticle(area.sym, 'cash', particleValue), Math.random() * 1000);
                }
                this.generation[i] = particleValue * particleTimes;
              }
                
            }
            state.nanites = 0;
          }
          break;
        }
      }
    });
  }

  getKeyVal(keyType) {
    const areaIndex = this.specialIndexes[keyType];
    const boughtKeys = this.state.areas[areaIndex].bought;
    const base = keyType === 'keys' ? 10 : 1e10;
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
    const OOM = Math.log10(Math.max(1, n));
    const h = (OOM * 300 / 25) % 300;
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

  roundToVal(value, roundType, roundVal) {
    return Math[roundType](value / roundVal) * roundVal;
  }

  roundExp(val, digits, roundType) {
    if (Math.abs(val) === Infinity) {return val.toString();}
    if (Math.abs(val) < 1e-9) {
      return `0.${'0'.repeat(digits)}e\u200b0`;
    }
    const neg = val < 0;
    const e = Math.floor(Math.log10(neg ? -val : val));
    const m = val / Math.pow(10.0, e);
    const roundm = this.roundToVal(m, roundType, Math.pow(10, -digits));
    const result = `${roundm.toFixed(digits)}e\u200b${e}`;
    return result;
  }

  draw() {

    this.areas.forEach( (area, i) => {
      const state = this.state.areas[i];
      const fgDiv = this.UI[`area_fg_${i}`];
      const progDiv = this.UI[`div_area_progress_${i}`];
      const areaContDiv = this.UI[`div_area_${i}`];
      const upgradeCost = this.getUpgradeCost(area.sym);
      switch (area.type) {
        case 'cell': {
          if (state.shield <= 0) {
            fgDiv.textContent = this.roundExp(state.nanites, 1, 'floor');
            progDiv.style.width = '0%';
            switch (this.state.color) {
              case 'str': {
                areaContDiv.style.backgroundColor = this.getUnlockedColor(state.nanites);
                break;
              }
              case 'gen': {
                areaContDiv.style.backgroundColor = this.getUnlockedColor(this.generation[i]);
                break;
              }
              case 'net': {
                const netGen = this.generation[i] + this.incoming[i] - this.outgoing[i];
                areaContDiv.style.backgroundColor = this.getUnlockedColor(netGen);
                break;
              }
              case 'upg': {
                const scaledValue = state.upgrades * 300 / 80;
                areaContDiv.style.backgroundColor = `hsl(${scaledValue},100%,50%)`;
                break;
              }
            }
          } else {
            fgDiv.textContent = this.roundExp(state.shield, 1, 'ceil');
            const progressPercent = 100 * state.shield / area.val;
            progDiv.style.width = `${progressPercent}%`;
            areaContDiv.style.backgroundColor = this.getUnlockedColor(state.shield);
          }
          fgDiv.style.color = state.nanites >= upgradeCost ? 'white' : 'black';
          fgDiv.style.textShadow = state.nanites >= upgradeCost ? '0px 0px 4px black' : '';
          break;
        }
        case 'spawn': {
          fgDiv.textContent = this.roundExp(state.nanites, 1, 'floor');
          areaContDiv.style.backgroundColor = this.getUnlockedColor(state.nanites);
          fgDiv.style.color = state.nanites >= upgradeCost ? 'white' : 'black';
          fgDiv.style.textShadow = state.nanites >= upgradeCost ? '0px 0px 4px black' : '';
          break;
        }
        case 'keyg':
        case 'keys': {
          const progressPercent = 100 * state.shield / state.val;
          progDiv.style.width = `${progressPercent}%`;
          const costDiv = this.UI[`div_${area.type}_cost`];
          costDiv.textContent = this.roundExp(state.shield, 1, 'ceil');
          break;
        }
        case 'rpgp': {
          if (state.nanites > 0) {
            this.startJiggleAnimation(fgDiv, 10, 2000);
          } else {
            this.stopJiggleAnimation(fgDiv);
          }
          
          break;
        }
        case 'slot': {
          if (state.nanites > 0) {
            this.startJiggleAnimation(fgDiv, 10, 2000);
          } else {
            this.stopJiggleAnimation(fgDiv);
          }

          break;
        }
      }
    });

    //update info box 
    this.UI.statsGenValueGlobal.textContent = this.roundExp(this.totalGeneration, 3, 'floor');
    const curTime = (new Date()).getTime();
    if (this.state.endTime === undefined) {
      this.UI.spanPlayTime.textContent = this.remainingToStr(curTime - this.state.gameStart, true);
    } else {
      this.UI.spanPlayTime.textContent = this.remainingToStr(this.state.endTime - this.state.gameStart, true);
    }

    this.UI.statsGenBuy.disabled = this.getGenCost() > this.state.cash;
    this.UI.statsTransBuy.disabled = this.getTransCost() > this.state.cash;
    this.UI.statsRecBuy.disabled = this.getRecCost() > this.state.cash;

    //update area info box
    if (this.selectedArea === undefined) {
      this.UI.areaInfoID.textContent = 'None';
      this.UI.areaInfoLock.textContent = '';
      this.UI.areaInfoValue.textContent = '';
      this.UI.areaInfoIncoming.textContent = '';
      this.UI.areaInfoOutgoing.textContent = '';
      this.UI.areaInfoUpgradeButton.disabled = true;
      this.UI.areaInfoUpgradeButton.textContent = '';
    } else {
      const selectedIndex = this.symbolIndexes[this.selectedArea];
      const selectedState = this.state.areas[selectedIndex];
      //const areaName = AREAS_NAMES[selectedIndex];
      switch (selectedIndex) {
        case 0: {//final
          this.UI.areaInfoID.textContent = '\ud83c\udfc6';
          break;
        }
        case 1: {//spawn
          this.UI.areaInfoID.textContent = '\ud83d\udc76';
          break;
        }
        case 7: {//keys
          this.UI.areaInfoID.textContent = '\ud83d\udd11';
          break;
        }
        case 30: {//keyg
          this.UI.areaInfoID.textContent = '\ud83d\udddd\ufe0f';
          break;
        }
        case 31: {//slot
          this.UI.areaInfoID.textContent = '\ud83c\udfb0';
          break;
        }
        case 32: {//fountain
          this.UI.areaInfoID.textContent = '\u26f2';
          break;
        }
        default: {
          this.UI.areaInfoID.textContent = String.fromCodePoint(0x1F600 + selectedIndex * 1);
        }
      }
      this.UI.areaInfoLock.textContent = ['None', 'Silver', 'Gold', 'Magic'][selectedState.lock];
      const netValue = selectedState.nanites - selectedState.shield;
      this.UI.areaInfoValue.textContent = this.roundExp(netValue, 3, 'floor');
      this.UI.areaInfoGen.textContent = this.roundExp(this.generation[selectedIndex], 3, 'floor');
      this.UI.areaInfoIncoming.textContent = this.roundExp(this.incoming[selectedIndex], 3, 'floor');
      this.UI.areaInfoOutgoing.textContent = this.roundExp(this.outgoing[selectedIndex], 3, 'floor');
      const netGen = this.generation[selectedIndex] + this.incoming[selectedIndex] - this.outgoing[selectedIndex];
      this.UI.areaInfoNet.textContent = this.roundExp(netGen, 3, 'floor');
      const upgradeCost = this.getUpgradeCost(this.selectedArea);
      this.UI.areaInfoUpgradeButton.disabled = netValue < upgradeCost;
      this.UI.areaInfoUpgradeButton.textContent = this.roundExp(upgradeCost, 3, 'ceil') + `(${selectedState.upgrades ?? ''})`;
    }

    window.requestAnimationFrame(() => this.draw());

  }

  createParticle(sym, type, value) {
    const particleLimit = 100;
    if (this.particleCount > particleLimit) {
      if (type === 'cash') {
        this.state.cashGenerated += value;
      }
      this.collectParticleAbstract(type, value);
      return;
    }

    this.particleCount += 1;
    const particle = document.createElement('div');
    particle.classList.add('particle');

    if (type === 'cash') {
      particle.innerText = '\u00a4'; //currency symbol. looks kinda like a nanobot...
      //chance to generate a gold particle
      const pBonus = 0.1;
      if (Math.random() < pBonus) {
        value = value * 2;
        particle.style.color = 'gold';
      }
      this.state.cashGenerated += value;
      this.playAudio('dropCoin');
    } else {
      particle.innerText = 'NANOMETERS'[value];
      particle.classList.add('particleLetters');
      particle.style.backgroundColor = this.letterColors[value % 4];
      this.playAudio('dropLetter');
    }


    document.body.appendChild(particle);

    particle.onmouseenter = (evt) => {
      this.collectParticle(particle, type, value, true);
    };

    const autoCollectTime = 5000;

    particle.timeoutID = setTimeout(() => {
      this.collectParticle(particle, type, value, false);
    }, autoCollectTime);

    particle.startTime = (new Date()).getTime();

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

  collectParticle(particle, type, value, sound) {
    this.particleCount -= 1;
    console.log('collect', value.toExponential(3));
    clearTimeout(particle.timeoutID);
    const curTime = (new Date()).getTime();
    const deltaTime = curTime - particle.startTime;
    particle.remove();
    this.collectParticleAbstract(type, value);
    if (sound || true) {
      this.playAudio(type === 'cash' ? 'pickupCoin' : 'pickupLetter');
    }
  }

  collectParticleAbstract(type, value) {
    if (type === 'cash') {
      this.state.cash += value;
      this.UI.cash.textContent = this.roundExp(this.state.cash, 3, 'floor');
      this.state.cashCollected += value;
    } else {
      this.state.letters[value] = 1;
      this.updateLettersDisplay();
    }
  }

  setAreaDir(sym, targetDir) {
    
    const areaIndex = this.symbolIndexes[sym];
    const areaType = this.areas[areaIndex].type;
    if (areaType !== 'cell' && areaType !== 'spawn') {
      return;
    }
    const state = this.state.areas[areaIndex];
    if (state.shield !== undefined && state.shield > 0) {
      return;
    }

    const areaDiv = this.UI[`div_area_${areaIndex}`];
    state.dir = targetDir !== 'none' ? targetDir : undefined;

    this.arrowDirs.forEach( dir => {
      this.UI[`div_area_arrow_${areaIndex}_${dir}`].style.display = dir === targetDir ? 'block' : 'none';
    });

  }

  attemptUnlock(sym) {
    const areaIndex = this.symbolIndexes[sym];
    const state = this.state.areas[areaIndex];
    if (state.lock !== undefined && (state.lock === 1 || state.lock === 2)) {
      if (state.lock === 1) {
        if (this.state.keysCount > 0) {
          this.state.keysCount -= 1;
          state.lock = 0;
          //remove key symbol from area
          this.UI[`area_fg_${areaIndex}`].style.backgroundImage = '';
          //update info box
          this.UI.spanKeyCountS.textContent = this.state.keysCount;
          this.playAudio('useKey');
        }
      } else {
        if (this.state.keygCount > 0) {
          this.state.keygCount -= 1;
          state.lock = 0;
          //remove key symbol from area
          this.UI[`area_fg_${areaIndex}`].style.backgroundImage = '';
          //update info box
          this.UI.spanKeyCountG.textContent = this.state.keygCount;
          this.playAudio('useKey');
        }
      }
    }
  }

  clickArea(sym) {
    console.log('CLICK AREA:', sym);
   
    this.attemptUnlock(sym);

    this.selectArea(sym);

  }

  selectArea(sym) {
    //unselect previous area 
    const curSelectedElement = document.getElementsByClassName('areaSelected');
    if (curSelectedElement.length > 0) {
      for (let i = curSelectedElement.length - 1; i >= 0; i--) {
        curSelectedElement.item(i).classList.remove('areaSelected');
      }
    }

    //select new cell
    const areaIndex = this.symbolIndexes[sym];
    const areaDiv = this.UI[`div_area_${areaIndex}`];
    areaDiv.classList.add('areaSelected');
    const progressDiv = this.UI[`div_area_progress_${areaIndex}`];
    progressDiv.classList.add('areaSelected');
    

    this.selectedArea = sym;
  }

  keydownArea(evt, sym) {
    const key = evt.code;
    const keyMap = {
      KeyW: 'up',
      KeyA: 'left',
      KeyS: 'down',
      KeyD: 'right',
      Digit8: 'toggleMagicLock',
      KeyZ: 'toggleMagicLock',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      Escape: 'none',
      Space: 'upgrade'

    };
    const action = keyMap[key];
    if (action === undefined) {return;}
    evt.preventDefault();
    
    switch (action) {
      case 'up':
      case 'left':
      case 'down':
      case 'right':
      case 'none': {
        this.setAreaDir(sym, action);
        break;
      }
      case 'upgrade': {
        this.buyUpgrade();
        break;
      }
      case 'toggleMagicLock': {
        this.toggleMagicLock(sym);
      }
    }

  }

  toggleMagicLock(sym) {
    const areaIndex = this.symbolIndexes[sym];
    const areaState = this.state.areas[areaIndex];
    const areaType = this.areas[areaIndex].type;
    const magicUnlocked = this.state.letters.reduce( (acc, e) => acc + e ) >= this.state.letters.length;
    if (magicUnlocked && areaState.shield > 0 && (areaType === 'cell' || areaType === 'spawn')) {
      if (areaState.lock === 0) {
        areaState.lock = 3;
        this.UI[`area_fg_${areaIndex}`].style.backgroundImage = 'url("magicKey.png")';
      } else if (areaState.lock === 3) {
        areaState.lock = 0;
        this.UI[`area_fg_${areaIndex}`].style.backgroundImage = '';
      }
    }
    
  }

  doGameWin() {
    this.state.endTime = (new Date()).getTime();
    const playTime = this.state.endTime - this.state.gameStart;
    this.UI.winPlayTime.textContent = this.remainingToStr(playTime, true);
    this.showModal('winContainer');
    this.saveToStorage();
  }

  shakeScreen() {
    if (this.state.shake === 0) {return;}
    const frames = [];
    const shakeElement = this.UI.gridContainer;
    const shakeSize = 5;

    for (let i = 0; i < 20; i++) {
      frames.push({transform: `translate(${(i % 2 === 0 ? 1 : -1) * shakeSize}px, 0px)`});
    }


    shakeElement.animate(
      frames, {
        duration: 1000
      }
    );
  }

  doAreaWin(sym) {
    const areaIndex = this.symbolIndexes[sym];
    const areaVal = this.areas[areaIndex].val;
    const minP = 2;
    const maxP = 6;
    const pCount = minP + Math.floor(Math.random() * (maxP - minP + 1));
    for (let i = 0; i < pCount; i++) {
      this.createParticle(sym, 'cash', areaVal / pCount);
    }
    //expected tries is about 60
    if (Math.random() < 0.5) {
      const letterIndex = Math.floor(Math.random() * 10);
      this.createParticle(sym, 'letter', letterIndex);
    }

    this.playAudio('explosion');
    this.shakeScreen();

    //check if win
    const win = this.areas.reduce( (acc, e, i) => {
      const state = this.state.areas[i];
      const type = this.areas[i].type;
      if (type !== 'cell' && type !== 'spawn') {
        return acc;
      }
      if (state.shield <= 0) {
        return acc;
      } 
      return false;
    }, true);

    if (win === true && this.state.endTime === undefined) {
      this.doGameWin();
    }
  }

  getGenValue(count) {
    return Math.pow(2, count);
  }

  getTransValue(count) {
    return Math.min(1, 0.01 * Math.pow(2, count));
  }

  getRecValue(count) {
    return 0.01 * Math.pow(0.9, count);
  }

  getGenCost() {
    return 1e2 * Math.pow(1e1, this.state.genCount);
  }

  getTransCost() {
    if (this.state.transCount === 6) {return Infinity;}
    return 1e4 * Math.pow(1e2, this.state.transCount);
  }

  getRecCost() {
    return 1e6 * Math.pow(1e3, this.state.recCount);
  }

  buyGen() {
    const cost = this.getGenCost();
    if (cost <= this.state.cash) {
      this.state.cash -= cost;
      this.state.genCount += 1;
      this.updateStatsDisplay();
    }
  }

  buyTrans() {
    const cost = this.getTransCost();
    if (cost <= this.state.cash) {
      this.state.cash -= cost;
      this.state.transCount += 1;
      this.updateStatsDisplay();
    }
  }

  buyRec() {
    const cost = this.getRecCost();
    if (cost <= this.state.cash) {
      this.state.cash -= cost;
      this.state.recCount += 1;
      this.updateStatsDisplay();
    }
  }

  getUpgradeValue(index) {
    const state = this.state.areas[index];
    
    return Math.pow(1.5, state.upgrades);
  }

  getUpgradeCost(sym) {
    const index = this.symbolIndexes[sym];
    const state = this.state.areas[index];
    const type = this.areas[index].type;

    if (type !== 'spawn' && type !== 'cell') {
      return Infinity;
    }

    //return AREAS[index].val * Math.pow(2, state.upgrades);
    //return Math.sqrt(this.areas[index].val) * Math.pow(2, state.upgrades);
    return Math.pow(this.areas[index].val, 1/2) * Math.pow(2, state.upgrades);
  }

  buyUpgrade() {
    const index = this.symbolIndexes[this.selectedArea];
    const state = this.state.areas[index];

    const cost = this.getUpgradeCost(this.selectedArea);

    if (state.nanites >= cost) {
      state.nanites -= cost;
      state.upgrades += 1;
    }
  }

  updateStatsDisplay() {
    const currencySymbol = '\u00a4';
    this.UI.statsGenValue.textContent = this.roundExp(this.getGenValue(this.state.genCount), 3, 'floor');
    this.UI.statsGenNext.textContent =  this.roundExp(this.getGenValue(this.state.genCount + 1), 3, 'floor');
    this.UI.statsGenCost.textContent = currencySymbol + this.roundExp(this.getGenCost(), 3, 'ceil');

    this.UI.statsTransValue.textContent = this.roundExp(this.getTransValue(this.state.transCount), 3, 'floor');
    this.UI.statsTransNext.textContent =  this.roundExp(this.getTransValue(this.state.transCount + 1), 3, 'floor');
    this.UI.statsTransCost.textContent = currencySymbol + this.roundExp(this.getTransCost(), 3, 'ceil');

    this.UI.statsRecValue.textContent = this.roundExp(this.getRecValue(this.state.recCount), 3, 'ceil');
    this.UI.statsRecNext.textContent =  this.roundExp(this.getRecValue(this.state.recCount + 1), 3, 'ceil');
    this.UI.statsRecCost.textContent = currencySymbol + this.roundExp(this.getRecCost(), 3, 'ceil');

    this.UI.cash.textContent = this.roundExp(this.state.cash, 3, 'floor');
  }

  updateLettersDisplay() {
    let letterCount = 0;
    this.state.letters.forEach( (v, i) => {
      const e = this.UI[`nd${i}`];
      e.style.backgroundColor = this.letterColors[i % 4];
      e.style.filter = v === 1 ? 'none' : 'blur(3px) grayscale(1)';
      letterCount += v;
    });

    if (letterCount >= this.state.letters.length) {
      //show magic key display
      this.UI.spanMagicKey.style.display = 'inline';
      if (this.lastLetterCount < letterCount) {
        this.playAudio('lettersComplete');
      }
    }
    this.lastLetterCount = letterCount;
  }

  startJiggleAnimation(element, limit, duration) {
    if (element.anim !== undefined) {return;}

    const frames = [
      {transform: 'rotate(0deg)'},
      {transform: `rotate(-${limit}deg)`},
      {transform: 'rotate(0deg)'},
      {transform: `rotate(${limit}deg)`},
      {transform: 'rotate(0deg)'}
    ];

    element.anim = element.animate(
      frames, {
        duration: duration,
        iterations: Infinity
      }
    );
  }

  stopJiggleAnimation(element) {
    if (element.anim === undefined) {return;}
    element.anim.cancel();
    element.anim = undefined;
  }

  createSlotsDeck() {
    const deckSize = 100;
    const winSpots = 1;

    this.slotDeck = (new Array(deckSize)).fill(false);

    //assuming winSpots is a lot smaller than deckSize or else this may be slow
    let spotsToPlace = winSpots;
    while (spotsToPlace > 0) {
      const spotIndex = Math.floor(Math.random() * deckSize);
      if (!this.slotDeck[spotIndex]) {
        this.slotDeck[spotIndex] = true;
          spotsToPlace--;
      }
    }
  }

  getSlotResult() {
    if (this.slotDeck.length === 0) {
      this.createSlotsDeck();
    }

    return this.slotDeck.pop();
  }

  changeColor(method) {
    this.state.color = method;
    console.log(method);
  }
}

const app = new App(AREAS, AREAS_GRID, AREAS_ORDER);
