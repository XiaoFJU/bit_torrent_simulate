module.exports = {
  Peer: function (id, downloadSpeed, uploadSpeed) {
    this.id = id;
    // this.downloadSpeed = downloadSpeed;
    this.uploadSpeed = uploadSpeed;

    this.bufferMap = [];
    this.requestQueue = [];

    this.neighbors = [];

    this.isBusy = () => {
      if (this.requestQueue.length > 0) {
        return true;
      } else {
        return false;
      }
    }

    this.addNeighbor = peerNO => {
      // check not self
      if (peerNO == this.id) {
        return;
      }
      // check neighbor is not alreay exist
      for (let element of this.neighbors){
        if (element.id == peerNO) {
          return;
        }
      }

      this.neighbors.push({
        id: peerNO,
        bufferMap: []
      });
    }

    this.randomGetUnfinishPiece = totlalFilePiece => {
      do {
        let randomPiece = Math.floor(Math.random() * totlalFilePiece);

        // if be chosen Piece not in buffer
        if (!this.hasPiece(randomPiece)) {
          return randomPiece;
        }
      } while (true);
    }

    this.progress = () => {
      if (this.isBusy()) {
        // get current mission(request)
        let current = this.requestQueue[0];

        // check complate
        if (current.progress + this.uploadSpeed >= current.fileSize) {
          // remove first ele
          return this.requestQueue.shift();
        } 
        current.progress += this.uploadSpeed
      }

      return null;
    }

    this.hasPiece = (piece) => {
      return this.bufferMap.includes(piece)
    }
  },

  RequestTask: function (requestPiece, fileSize, sender) {
    this.requestPiece = requestPiece;
    this.fileSize = fileSize;
    this.sender = sender;

    this.progress = 0;
  }
};