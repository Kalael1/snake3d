export class SpyfallGame {
    constructor(io, getPlayersInRoom, getPlayerInfo) {
        this.io = io;
        this.getPlayersInRoom = getPlayersInRoom;
        this.getPlayerInfo = getPlayerInfo;
        
        this.LOCATIONS = ['Hastane', 'Okul', 'Korsan Gemisi', 'Uzay İstasyonu', 'Banka', 'Polis Merkezi', 'Denizaltı', 'Sirk Çadırı', 'Yolcu Uçağı', 'Otel', 'Kutup Noktası'];
        
        this.status = 'waiting'; 
        this.location = '';
        this.spyId = null;
        this.alivePlayers = []; 
        this.turnPlayerId = null;
        this.logs = [];
    }
    
    log(msg) {
        this.logs.push(msg);
        if (this.logs.length > 5) this.logs.shift();
    }
    
    broadcast() {
        const clients = this.getPlayersInRoom('spyfall');
        
        clients.forEach(id => {
            const socket = this.io.sockets.sockets.get(id);
            if (!socket) return;
            
            const isSpy = (id === this.spyId);
            let location = 'BİLİNMİYOR';
            let role = 'İzleyici';
            
            if (this.alivePlayers.includes(id)) {
                role = isSpy ? 'Casus' : 'Vatandaş';
                if (!isSpy && this.status !== 'waiting') location = this.location;
            }
            
            socket.emit('spyfallState', {
                status: this.status,
                alivePlayers: this.alivePlayers,
                turnPlayerId: this.turnPlayerId,
                role: role,
                location: location,
                logs: this.logs
            });
        });
    }
    
    start() {
        const clients = this.getPlayersInRoom('spyfall');
        if (clients.length < 2) {
            this.io.to('spyfall').emit('chatReceived', { id: 'sys', name: 'SİSTEM', text: 'En az 2 kişi gerekiyor!' });
            return;
        }
        
        this.status = 'playing';
        this.alivePlayers = [...clients];
        this.location = this.LOCATIONS[Math.floor(Math.random() * this.LOCATIONS.length)];
        this.spyId = this.alivePlayers[Math.floor(Math.random() * this.alivePlayers.length)];
        this.turnPlayerId = this.alivePlayers[Math.floor(Math.random() * this.alivePlayers.length)];
        
        this.logs = [];
        this.log('Oyun Başladı! Sıra: ' + this.getPlayerInfo(this.turnPlayerId).name);
        this.broadcast();
    }
    
    askQuestion(fromId, toId, question) {
        if (this.status !== 'playing') return;
        if (this.turnPlayerId !== fromId) return;
        if (!this.alivePlayers.includes(toId)) return;
        
        const pFrom = this.getPlayerInfo(fromId).name;
        const pTo = this.getPlayerInfo(toId).name;
        
        this.io.to('spyfall').emit('chatReceived', { id: 'sys', name: 'SİSTEM', text: `[SORU] ${pFrom} -> ${pTo}: ${question}` });
        
        this.turnPlayerId = toId; 
        this.log(`Sıra: ${pTo}`);
        this.broadcast();
    }
    
    voteEliminate(voterId, targetId) {
        if (this.status !== 'playing') return;
        
        const pTarget = this.getPlayerInfo(targetId).name;
        this.alivePlayers = this.alivePlayers.filter(id => id !== targetId);
        
        this.io.to('spyfall').emit('chatReceived', { id: 'sys', name: 'SİSTEM', text: `[OYLAMA] ${pTarget} elendi!` });
        
        if (targetId === this.spyId) {
            this.status = 'game_over';
            this.log('Vatandaşlar Kazandı! Casus: ' + pTarget);
        } else if (this.alivePlayers.length <= 2) {
            this.status = 'game_over';
            this.log('Casus Kazandı! Casus: ' + this.getPlayerInfo(this.spyId).name);
        } else {
            if (this.turnPlayerId === targetId) {
                this.turnPlayerId = this.alivePlayers[Math.floor(Math.random() * this.alivePlayers.length)];
            }
        }
        this.broadcast();
    }
    
    triggerNight() {
        if (this.status !== 'playing') return;
        this.status = 'night';
        this.log('Gece oldu. Sadece Casus uyanık.');
        this.broadcast();
    }
    
    spyKill(spyId, targetId) {
        if (this.status !== 'night') return;
        if (this.spyId !== spyId) return;
        if (!this.alivePlayers.includes(targetId)) return;
        
        const pTarget = this.getPlayerInfo(targetId).name;
        this.alivePlayers = this.alivePlayers.filter(id => id !== targetId);
        
        this.io.to('spyfall').emit('chatReceived', { id: 'sys', name: 'SİSTEM', text: `[GECE] ${pTarget} öldürüldü!` });
        
        if (this.alivePlayers.length <= 2) {
            this.status = 'game_over';
            this.log('Casus Kazandı! Casus: ' + this.getPlayerInfo(this.spyId).name);
        } else {
            this.status = 'playing';
            this.log('Sabah oldu. Sorguya devam.');
            if (this.turnPlayerId === targetId) {
                this.turnPlayerId = this.alivePlayers[Math.floor(Math.random() * this.alivePlayers.length)];
            }
        }
        this.broadcast();
    }
    
    playerLeft(socketId) {
        if (this.alivePlayers.includes(socketId)) {
            this.alivePlayers = this.alivePlayers.filter(id => id !== socketId);
            if (socketId === this.spyId && this.status !== 'game_over') {
                this.status = 'game_over';
                this.log('Casus kaçtı. Vatandaşlar Kazandı!');
            } else if (this.alivePlayers.length <= 2 && this.status !== 'game_over') {
                this.status = 'game_over';
                this.log('Yeterli oyuncu kalmadı. Casus Kazandı!');
            }
            this.broadcast();
        }
    }
}
