const tourDate = new Date("2026-11-14T19:30:00+08:00");
const countdown = document.getElementById("倒數");

function updateCountdown() {
	const remaining = tourDate.getTime() - Date.now();
	if (remaining <= 0) {
		countdown.textContent = "台北首場，今晚見。";
		return;
	}

	const days = Math.floor(remaining / 86400000);
	const hours = Math.floor((remaining % 86400000) / 3600000);
	const minutes = Math.floor((remaining % 3600000) / 60000);
	countdown.textContent = `${days} 天 ${hours} 小時 ${minutes} 分`;
}

updateCountdown();
window.setInterval(updateCountdown, 60000);

const playButton = document.getElementById("play-toggle");
const playIcon = playButton.querySelector(".play-icon");
const playLabel = document.getElementById("play-label");
const playerStatus = document.getElementById("player-status");
const progress = document.getElementById("track-progress");
const currentTime = document.getElementById("current-time");
const waveform = document.querySelector(".waveform");
const trackDuration = 16;
const chordProgression = [
	[146.83, 220, 261.63, 329.63],
	[116.54, 174.61, 233.08, 293.66],
	[130.81, 196, 261.63, 329.63],
	[98, 146.83, 220, 293.66]
];
const melody = [293.66, 349.23, 392, 440, 392, 349.23, 329.63, 392, 440, 523.25, 440, 392, 349.23, 329.63, 293.66, 261.63, 293.66, 349.23, 392, 349.23, 329.63, 293.66, 261.63, 293.66, 329.63, 392, 440, 392, 349.23, 329.63, 293.66, 261.63];
let audioContext;
let activeOscillators = [];
let playbackStartedAt = 0;
let playbackOffset = 0;
let progressTimer;
let finishTimer;

function formatTime(seconds) {
	const wholeSeconds = Math.floor(seconds);
	return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function updateProgress(seconds) {
	const boundedTime = Math.max(0, Math.min(trackDuration, seconds));
	progress.value = boundedTime;
	currentTime.textContent = formatTime(boundedTime);
}

function scheduleTone(frequency, startAt, duration, type, volume) {
	const oscillator = audioContext.createOscillator();
	const envelope = audioContext.createGain();
	const filter = audioContext.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = type === "triangle" ? 720 : 1400;
	oscillator.type = type;
	oscillator.frequency.value = frequency;
	envelope.gain.setValueAtTime(0.0001, startAt);
	envelope.gain.exponentialRampToValueAtTime(volume, startAt + 0.16);
	envelope.gain.setValueAtTime(volume, startAt + Math.max(0.17, duration - 0.22));
	envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
	oscillator.connect(filter);
	filter.connect(envelope);
	envelope.connect(audioContext.destination);
	oscillator.start(startAt);
	oscillator.stop(startAt + duration + 0.03);
	activeOscillators.push(oscillator);
}

function composePreview(offset) {
	const startAt = audioContext.currentTime;
	const beat = 0.5;
	const chordLength = 4;

	chordProgression.forEach((chord, chordIndex) => {
		const eventTime = chordIndex * chordLength;
		if (eventTime + chordLength <= offset) return;
		const relativeStart = Math.max(0, eventTime - offset);
		const remainingLength = chordLength - Math.max(0, offset - eventTime);
		chord.forEach((frequency, noteIndex) => {
			scheduleTone(frequency, startAt + relativeStart, remainingLength, "sine", noteIndex === 0 ? 0.018 : 0.012);
		});
	});

	melody.forEach((frequency, noteIndex) => {
		const eventTime = noteIndex * beat;
		if (eventTime + beat <= offset) return;
		const relativeStart = Math.max(0, eventTime - offset);
		const remainingLength = Math.min(0.42, beat - Math.max(0, offset - eventTime));
		scheduleTone(frequency, startAt + relativeStart, remainingLength, "triangle", 0.035);
	});

	playbackStartedAt = startAt;
	playbackOffset = offset;
	progressTimer = window.setInterval(() => {
		updateProgress(playbackOffset + audioContext.currentTime - playbackStartedAt);
	}, 100);
	finishTimer = window.setTimeout(stopPreview, Math.max(0, (trackDuration - offset) * 1000));
}

function setPlaying(isPlaying) {
	playIcon.textContent = isPlaying ? "Ⅱ" : "▶";
	playLabel.textContent = isPlaying ? "暫停試聽" : "播放試聽";
	playButton.setAttribute("aria-label", isPlaying ? "暫停試聽" : "播放試聽");
	waveform.classList.toggle("is-playing", isPlaying);
}

function stopPreview() {
	if (audioContext) {
		playbackOffset = Math.min(trackDuration, playbackOffset + audioContext.currentTime - playbackStartedAt);
		audioContext.close();
		audioContext = undefined;
	}
	window.clearInterval(progressTimer);
	window.clearTimeout(finishTimer);
	activeOscillators = [];
	if (playbackOffset >= trackDuration) {
		playbackOffset = 0;
		updateProgress(0);
		playerStatus.textContent = "試聽結束，再聽一次？";
	} else {
		updateProgress(playbackOffset);
		playerStatus.textContent = "已暫停，隨時繼續";
	}
	setPlaying(false);
}

async function startPreview() {
	if (playbackOffset >= trackDuration) playbackOffset = 0;
	const AudioContextClass = window.AudioContext || window.webkitAudioContext;
	if (!AudioContextClass) {
		playerStatus.textContent = "此瀏覽器不支援音訊試聽";
		return;
	}

	try {
		audioContext = new AudioContextClass();
		await audioContext.resume();
		composePreview(playbackOffset);
		setPlaying(true);
		playerStatus.textContent = "正在播放合成示範音色";
	} catch {
		playerStatus.textContent = "無法啟動音訊，請再試一次";
		setPlaying(false);
	}
}

playButton.addEventListener("click", () => {
	if (audioContext) stopPreview();
	else startPreview();
});

progress.addEventListener("input", () => {
	if (audioContext) stopPreview();
	playbackOffset = Number(progress.value);
	updateProgress(playbackOffset);
	playerStatus.textContent = playbackOffset ? "已選擇試聽位置" : "點擊播放，聽一段夜色";
});
