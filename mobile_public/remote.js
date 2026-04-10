const socket = io({
    extraHeaders: {
        "bypass-tunnel-reminder": "true"
    }
});

// UI Elements
const statusIndicator = document.getElementById('connection-status');
const coverImg = document.getElementById('media-cover');
const coverPlaceholder = document.getElementById('media-placeholder');
const titleText = document.getElementById('media-title');
const artistText = document.getElementById('media-artist');
const timeCur = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const seekSlider = document.getElementById('seek-slider');
const volSlider = document.getElementById('vol-slider');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

let isScrubbing = false;

// Format seconds into m:ss
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Socket Connection Status
socket.on('connect', () => {
    statusIndicator.className = 'status connected';
});
socket.on('disconnect', () => {
    statusIndicator.className = 'status';
});

// Broadcast State Receiver
socket.on('state', (state) => {
    titleText.textContent = state.title || 'Not Playing';
    artistText.textContent = state.artist || 'Sovereign Media';

    if (state.coverPath) {
        coverImg.src = '/media-file?path=' + encodeURIComponent(state.coverPath);
        coverImg.style.display = 'block';
        coverPlaceholder.style.display = 'none';
    } else {
        coverImg.style.display = 'none';
        coverPlaceholder.style.display = 'flex';
    }

    if (state.playing) {
        btnPlayPause.textContent = '⏸';
    } else {
        btnPlayPause.textContent = '▶';
    }

    if (!isScrubbing && state.duration > 0) {
        seekSlider.max = state.duration;
        seekSlider.value = state.currentTime;
        timeCur.textContent = formatTime(state.currentTime);
        timeTotal.textContent = formatTime(state.duration);
    }

    // Don't fight the user if they are dragging the volume
    if (document.activeElement !== volSlider) {
        volSlider.value = state.volume;
    }
});

// Control Events
btnPlayPause.addEventListener('click', () => {
    socket.emit('action', { type: 'togglePlay' });
});

btnPrev.addEventListener('click', () => {
    socket.emit('action', { type: 'prev' });
});

btnNext.addEventListener('click', () => {
    socket.emit('action', { type: 'next' });
});

volSlider.addEventListener('input', (e) => {
    socket.emit('action', { type: 'volume', value: parseFloat(e.target.value) });
});

// Prevent visual jutting while sliding
seekSlider.addEventListener('mousedown', () => isScrubbing = true);
seekSlider.addEventListener('touchstart', () => isScrubbing = true);
seekSlider.addEventListener('input', (e) => {
    timeCur.textContent = formatTime(e.target.value);
});
seekSlider.addEventListener('change', (e) => {
    socket.emit('action', { type: 'seek', value: parseFloat(e.target.value) });
    isScrubbing = false;
});
seekSlider.addEventListener('touchend', (e) => {
    socket.emit('action', { type: 'seek', value: parseFloat(e.target.value) });
    isScrubbing = false;
});
