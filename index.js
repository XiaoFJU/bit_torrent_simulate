const config = require('config');
const Peer = require('./peer');

let filePieceNumber = config.get('filePieceNumber');
let pieceSize = config.get('pieceSize');
let downloadSpeed = config.get('downloadSpeed');
let uploadSpeed = config.get('uploadSpeed');

function simulate(peerNum, neighborPerPeer, strategy) {
  let currTime = -1;
  let complateTime = [];

  // 初始化模擬物件
  let seed = new Peer.Peer(0, downloadSpeed, uploadSpeed);
  for(let i=0; i<filePieceNumber; i++){
    // seed 應該要有所有的片段
    seed.bufferMap.push(i);
  }

  let peers = [];
  peers[0] = seed;
  for(let i=1; i<=peerNum; i++){
    peers[i] = new Peer.Peer(i, downloadSpeed, uploadSpeed);
    
    // 隨機選鄰居，直到鄰居數量足夠
    while(peers[i].neighbors.length < neighborPerPeer){
      let randomPeer = Math.floor(Math.random()*peerNum)+1;
      peers[i].addNeighbor(randomPeer);
    }

    // 特殊規則: 一開始給每個　peer 2個 piece，
    // 避免一開始同時向 seed 發請求，造成長長的排隊
    while(peers[i].bufferMap.length < 2) {
      let randomNum = peers[i].randomGetUnfinishPiece(filePieceNumber);       
      peers[i].bufferMap.push(randomNum);
    }
  }
  
  let finishFlag = false;

  // 直到所有任務完成
  while( !finishFlag ) {
    currTime++;

    // 處理服務，進程往前
    peers.forEach((peer, idx) => {
      let complateTask = peer.progress();
      if (complateTask != null) {
        let receiver = complateTask.sender;
        let piece = complateTask.requestPiece;
        if (!peers[receiver].bufferMap.includes(piece)){
          peers[receiver].bufferMap.push(piece);
        }

        // 如果下載完成　紀錄完成時間(currTime)
        complateTime[peer.id] = currTime;
      }
    });

    // 鄰居交換 buffer map
    peers.forEach((peer, idx) => {
      // peer 收集其鄰居的 bufer map
      peer.neighbors.forEach(neighbor => {
        neighbor.bufferMap = peers[neighbor.id].bufferMap;
      })
    })

    // 選擇下一個片段，發出下載request
    peers.forEach((peer, idx) => {
      if( peer.id != 0 
        && peer.bufferMap.length < filePieceNumber 
        && !peer.isBusy()){
        let nextPiece;
          
        // 出發新任務
        switch(strategy) {
          // randomSelection 隨機選擇下一個要下載的 piece
          case 'randomSelection': {
            nextPiece = peer.randomGetUnfinishPiece(filePieceNumber);

            // 隨機選擇一個鄰居，並確認有該 piece 
            shuffle(peer.neighbors)
            let targetNeighbor;
            for (let neighbor of peer.neighbors) {
              if (neighbor.bufferMap.includes(nextPiece)){
                targetNeighbor = peers[neighbor.id];
                break;
              }
            }
            // 若無，則對 seed　請求該 piece            
            if (typeof(targetNeighbor) == 'undefined') {
              targetNeighbor = seed;
            }

            //　新增任務到佇列(queue)
            requestTask = new Peer.RequestTask(nextPiece, pieceSize ,peer.id);
            targetNeighbor.requestQueue.push(requestTask)
            break;
          }

          // rarestFirst 依照稀有度選擇下一個要下載的 piece
          case 'rarestFirst': {
            let rarestCala = [];
            for (let neighbor of peer.neighbors) {
              for (let piece of neighbor.bufferMap) {
                // 統計自己沒有的片段
                if (peer.bufferMap.includes(piece)) {
                  continue;
                } else {
                  if (typeof(rarestCala[piece]) == 'undefined') {
                    rarestCala[piece] = 1;
                  } else {
                    rarestCala[piece]++;
                  }
                }
              }
            } 
            // 如果總和為0　代表擁有鄰居的所有 piece
            // 建議向 seed 請求
            let numOrZero = n => isNaN(n) ? 0 : n
            // if (rarestCala.reduce((a, b) => numOrZero(a) + numOrZero(b)) == 0) {
            if (rarestCala.length == 0) {
              let nextPiece = peer.randomGetUnfinishPiece(filePieceNumber);
              requestTask = new Peer.RequestTask(nextPiece, pieceSize ,peer.id);
              seed.requestQueue.push(requestTask)
              
              break;
            }

            // 從稀有度最高(鄰居持有最少)的隨機挑選一個            
            let min = peer.neighbors.length;
            for (num of rarestCala) {
              if (typeof(num) != 'undefined' && num < min){
                min = num;
              }
            }
            let rarestPieces = [];
            for (const [index, value] of rarestCala.entries()) {
              if (value == min) {
                rarestPieces.push(index);
              }
            }
            let nextPieceNO = Math.floor(Math.random() * rarestPieces.length);
            let nextPiece = rarestPieces[nextPieceNO];

            //　隨機一個有這個 piece 的鄰居
            let rarestNeighbors = [];
            for (let neighbor of peer.neighbors) {
              if (neighbor.bufferMap.includes(nextPiece)) {
                rarestNeighbors.push(neighbor.id);
              }
            }
            let targetNeighborNO = Math.floor(Math.random() * rarestNeighbors.length);
            targetNeighbor = peers[rarestNeighbors[targetNeighborNO]];

            // delete
            if (typeof targetNeighbor == 'undefined'){
              let a;
            }

            //　新增任務到佇列(queue)
            requestTask = new Peer.RequestTask(nextPiece, pieceSize ,peer.id);
            targetNeighbor.requestQueue.push(requestTask)
            
            break;
          }
          default:
            console.error('unknown strategy');
            return ;
        }
      }
    });

    // 從 queue 中選擇下一個要服務的 request
    peers.forEach((peer, idx) => {
      while (peer.requestQueue.length > 0){
        let nextTask = peer.requestQueue[0];
        // 如果請求的 peer 已經有該片段的話跳過
        if (peers[nextTask.sender].hasPiece(nextTask.requestPiece)){
          peer.requestQueue.shift();
        } else {
          break;
        }
      }
    })

    // console.log(peers)

    // console.log('requestQueue buferMp')
    // peers.forEach((p,i)=>{
    //   console.log(`peer${i}\t ${p.requestQueue.length}\t ${p.bufferMap.length}`)
    // })
    
    // 確認是否完成了
    finishFlag = true;
    peers.forEach((peer, idx)=>{
      if (peer.bufferMap.length < filePieceNumber){
        finishFlag = false;
      }
    })
  }

  return complateTime;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}


// n is peer number
let n = config.get('peerNumber');

// d is number of neighbors per peer
let d = config.get('neighborsPerPeer');

// let complateTime = simulate(n, d, strategy='randomSelection');
// console.log('# randomSelection complateTime :', complateTime);

// complateTime = simulate(n, d, strategy='rarestFirst');
// console.log('# rarestFirst complateTime :', complateTime);

// Q1
console.log("\n===========Q1===========");
d = 10;
[50, 100, 150, 200, 250].forEach(n=>{
  console.log(`[n=${n} d=${d}] `)
  
  let complateTime = simulate(n, d, strategy='randomSelection');
  console.log('# randomSelection complateTime : ['+ complateTime.reduce((a,b)=>{return `${a}, ${b}`}) + ']');
  console.log(`avg_time = ${complateTime.reduce((a,b)=>{return a+b})/n}\n`)

  complateTime = simulate(n, d, strategy='rarestFirst');
  console.log('# rarestFirst complateTime : ['+ complateTime.reduce((a,b)=>{return `${a}, ${b}`}) + ']');
  console.log(`avg_time = ${complateTime.reduce((a,b)=>{return a+b})/n}\n`)
})

// Q2
console.log("\n===========Q2===========");
n = 50;
[10, 20, 30, 40, 49].forEach(d=>{
  console.log(`[n=${n} d=${d}] `)
  
  let complateTime = simulate(n, d, strategy='randomSelection');
  console.log('# randomSelection complateTime : ['+ complateTime.reduce((a,b)=>{return `${a}, ${b}`}) + ']')
  console.log(`avg_time = ${complateTime.reduce((a,b)=>{return a+b})/n}\n`)

  complateTime = simulate(n, d, strategy='rarestFirst');
  console.log('# rarestFirst complateTime : ['+ complateTime.reduce((a,b)=>{return `${a}, ${b}`}) + ']');
  console.log(`avg_time = ${complateTime.reduce((a,b)=>{return a+b})/n}\n`)
})