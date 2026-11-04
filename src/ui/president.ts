// The President: an animated pixel portrait on the board that publishes posts about the game.
import { spriteURL } from '../art/sprite';
import { POSTS } from '../data/politics';
import { $, setText } from './dom';

const FRAMES = ['potus', 'potus_blink', 'potus_talk', 'potus_shout', 'potus_point', 'potus_thumbs', 'potus_sign'];
const SIZE = 132;

let img: HTMLImageElement;
let talkUntil = 0;
let bubbleUntil = 0;
let pose = 'potus_point';
let blinkAt = 0;
let idleAt = 0;
let lastFrame = '';
let queue: { text: string; pose: string }[] = [];

function url(id: string): string {
  return spriteURL(id, 0, SIZE, SIZE);
}

export function initPresident(onClick: () => void): void {
  const btn = $('#potus-btn');
  img = new Image();
  img.className = 'sprite';
  img.alt = '';
  img.draggable = false;
  btn.append(img);
  for (const f of FRAMES) url(f);
  btn.addEventListener('click', () => {
    onClick();
    $('#potus').classList.remove('bump'); void btn.offsetWidth; $('#potus').classList.add('bump');
  });
  idleAt = performance.now() + 25000;
  show('potus');
}

function show(id: string): void {
  if (id === lastFrame) return;
  lastFrame = id;
  img.src = url(id);
}

/** Publishes a post. Lower-priority posts wait while another is on screen. */
export function say(text: string, p = 'talk', urgent = true): void {
  const now = performance.now();
  if (!urgent && now < bubbleUntil) { if (queue.length < 2) queue.push({ text, pose: p }); return; }
  const id = p.startsWith('potus') ? p : `potus_${p}`;
  pose = FRAMES.includes(id) ? id : 'potus_talk';
  setText($('#potus-text'), text);
  const ms = Math.min(9000, 2500 + text.length * 45);
  talkUntil = now + Math.min(ms, 1200 + text.length * 30);
  bubbleUntil = now + ms;
  idleAt = now + 30000 + Math.random() * 25000;
  const b = $('#potus-bubble');
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

export function randomPost(): string {
  return POSTS[Math.floor(Math.random() * POSTS.length)];
}

export function updatePresident(): void {
  if (!img) return;
  const now = performance.now();
  if (now > bubbleUntil) {
    $('#potus-bubble').classList.remove('show');
    const next = queue.shift();
    if (next) { say(next.text, next.pose); return; }
  }
  if (now > idleAt) say(randomPost(), Math.random() < 0.5 ? 'point' : 'talk');
  if (now < talkUntil) {
    // Alternate the gesture pose with an open-mouth frame for a speaking effect.
    const open = Math.floor(now / 140) % 2 === 0;
    const gesture = pose === 'potus_talk' ? (open ? 'potus_talk' : 'potus') : pose === 'potus_shout' ? (open ? 'potus_shout' : 'potus_talk') : pose;
    show(gesture);
    return;
  }
  if (now < bubbleUntil && pose !== 'potus_talk' && pose !== 'potus_shout') { show(pose); return; }
  if (now > blinkAt) {
    show('potus_blink');
    if (now > blinkAt + 140) blinkAt = now + 2200 + Math.random() * 3200;
    return;
  }
  show('potus');
}
