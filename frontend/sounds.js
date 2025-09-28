// Sound effects for the application
class SoundManager {
    constructor() {
        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        this.enabled = true;
        
        // Initialize sounds
        this.initSounds();
    }
    
    initSounds() {
        // Create a simple beep sound for notifications
        this.createBeepSound('notification', 880, 0.2);
        
        // Create a connection sound
        this.createBeepSound('connected', 523.25, 0.3); // C5
        this.createBeepSound('connected2', 659.25, 0.3); // E5
        this.createBeepSound('connected3', 783.99, 0.3); // G5
        
        // Create a disconnect sound
        this.createBeepSound('disconnected', 220, 0.5); // A3
        
        // Create a match found sound
        this.createMelodySound('matched');
    }
    
    createBeepSound(name, frequency, duration) {
        this.sounds[name] = () => {
            if (!this.enabled) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    createMelodySound(name) {
        this.sounds[name] = () => {
            if (!this.enabled) return;
            
            const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C
            const duration = 0.15;
            
            frequencies.forEach((freq, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.value = freq;
                
                const startTime = this.audioContext.currentTime + (index * duration);
                
                gainNode.gain.setValueAtTime(0.3, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration - 0.01);
                
                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            });
        };
    }
    
    play(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }
    
    toggle() {
        this.enabled = !this.enabled;
    }
}

// Initialize sound manager
const soundManager = new SoundManager();